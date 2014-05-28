$(function() {

	// Flot tick formatter: bytes
	function sizeTickFormatter(val, axis) {
		return humanSize(val);
	};

	// Flot tick formatter: bytes/second
	function speedTickFormatter(val, axis) {
		return sizeTickFormatter(val, axis) + "/s";
	};

	function roundNextPowerOfTwo(val) {
		return Math.pow(2, Math.ceil(Math.log(val)/Math.log(2)));
	};

	function humanSize(val) {
		var u = 0;
		var units = ['B','KiB','MiB','GiB','TiB'];
		while(val > 1024) { u++; val /= 1024; }
		return val.toFixed(2)+units[u];
	};

	// helper function: returns a string with the current datetime
	function currentHumanTime() {
		var date = new Date(Date.now());
		var Y = date.getFullYear();
		var M = date.getMonth() + 1;
		M = ((M<10) ? "0"+M : M);
		var D = date.getDate();
		D = ((D<10) ? "0"+D : D);
		var h = date.getHours();
		h = ((h<10) ? "0"+h : h);
		var m = date.getMinutes();
		m = ((m<10) ? "0"+m : m);
		var s = date.getSeconds();
		s = ((s<10) ? "0"+s : s);
		var ms = date.getMilliseconds();
		ms = ((ms<10) ? "00"+ms : (ms<100) ? "0"+ms : ms);
		return Y+"/"+M+"/"+D+" "+h+":"+m+":"+s+"."+ms;
	};

	function humanTime(timestamp) {
		var date = new Date(timestamp);
		var Y = date.getFullYear();
		var M = date.getMonth() + 1;
		M = ((M<10) ? "0"+M : M);
		var D = date.getDate();
		D = ((D<10) ? "0"+D : D);
		var h = date.getHours();
		h = ((h<10) ? "0"+h : h);
		var m = date.getMinutes();
		m = ((m<10) ? "0"+m : m);
		var s = date.getSeconds();
		s = ((s<10) ? "0"+s : s);
		var ms = date.getMilliseconds();
		ms = ((ms<10) ? "00"+ms : (ms<100) ? "0"+ms : ms);
		return Y+"/"+M+"/"+D+" "+h+":"+m+":"+s+"."+ms;
	}

	// helper function: logs something into console with a timestamp
	function log(msg) {
		console.log(currentHumanTime() + " " + msg);
	};



	/*******************************************************
	 * MODEL: Represents a Torrent currently in the client *
	 *******************************************************/
	var TorrentReference = Backbone.Model.extend({

		// which attribute is the identifier for this model
		idAttribute: 'id',

		// pieces - used and populated by logPieces()
		pieces: undefined,
		oldPieces: undefined, // temporary value
		pieceLog: [],
		totalPieces: 0,
		totalPiecesLog: [],
		consecutivePieces: 0,
		consecutivePiecesLog: [],

		// speed - used and populated by logSpeed()
		downloadSpeed: 0,
		downloadSpeedLog: [],
		uploadSpeed: 0,
		uploadSpeedLog: [],

		// creationTime - when object was created - populated on initialization
		creationTime: undefined,

		// initialize the model
		initialize: function() {
			_.bindAll(this, 'stopCollection', 'elapsedTime', 'numPieces', 'setupLogPieces', 'setupLogSpeed', 'logPieces', 'logConsecutivePieces', 'logTotalPieces', 'logDownloadSpeed', 'logUploadSpeed', 'getTorrent', 'getFileList', 'getPeerList', 'getProperties', 'getProperty', 'getFile', 'getFileProperties', 'getFileProperty');
			this.creationTime = new Date(Date.now());
			this.setupLogPieces();
			this.setupLogSpeed();
			this.getProperties().on('change:completed_on', _.bind(this.stopCollection, this));
		},

		// stop collection of data
		stopCollection: function() {
			log("stopping collection");
			this.stopListening(this.getTorrent());
			this.stopListening(this.getProperties());
			this.getProperties().off('change:download_speed');
			this.getProperties().off('change:upload_speed');
			clearInterval(this.piecesTimer);
		},

		// get elapsed time
		elapsedTime: function() {
			currentTime = Date.parse(new Date(Date.now()));
			startTime = Date.parse(this.creationTime);
			return currentTime - startTime;
		},

		// get number of pieces
		numPieces: function() {
			return (this.pieces ? this.pieces.length/2 : 'not available');
		},

		// setup logging of piece retrievals
		setupLogPieces: function() {
			this.getTorrent().pieces().then(_.bind(function(data) {
				this.oldPieces = Array(data.length).join("0");
				this.pieces = data;
				this.logConsecutivePieces();
				this.logTotalPieces(this.oldPieces, this.pieces);
			}, this));
			this.piecesTimer = setInterval(_.bind(function() {
				this.getTorrent().pieces().then(_.bind(this.logPieces, this));
			}, this), 1000);
		},

		// stop collecting information
		setupLogSpeed: function() {
			this.getProperties().on('change:download_speed', _.bind(this.logDownloadSpeed, this));
			this.getProperties().on('change:upload_speed', _.bind(this.logUploadSpeed, this));
		},

		// log piece retrievals
		logPieces: function(data) {
			this.oldPieces = this.pieces;
			this.pieces = data;
			this.logConsecutivePieces();
			this.logTotalPieces(this.oldPieces, this.pieces);
			this.trigger('newpieces');
		},

		logConsecutivePieces: function() {
			var elapsedTime = this.elapsedTime();
			for(var i=2*this.consecutivePieces; i<this.pieces.length; i+=2) {
				if(this.pieces[i] == '0' && this.pieces[i+1] == '1') {
					this.consecutivePieces++;
				}
				else { break; }
			}
			this.consecutivePiecesLog.push([elapsedTime, this.consecutivePieces]);
		},

		logTotalPieces: function(oldPieces, newPieces) {
			var elapsedTime = this.elapsedTime();
			for(var i=0; i<newPieces.length; i+=2) {
				var oldData = oldPieces.slice(i, i+2);
				var newData = newPieces.slice(i, i+2);
				if((!_.isEqual(oldData, newData)) &&
				   (newData[0] == '0' && newData[1] == '1')) {
					this.totalPieces++;
				}
			}
			this.totalPiecesLog.push([elapsedTime, this.totalPieces]);
		},

		logDownloadSpeed: function(properties, speed) {
			var elapsedTime = this.elapsedTime();
			this.downloadSpeed = speed;
			this.downloadSpeedLog.push([elapsedTime, this.downloadSpeed]);
		},

		logUploadSpeed: function(properties, speed) {
			var elapsedTime = this.elapsedTime();
			this.uploadSpeed = speed;
			this.uploadSpeedLog.push([elapsedTime, this.uploadSpeed]);
		},

		// return the Btapp object associated with this torrent
		getTorrent: function() {
			return btapp.get('torrent').get(this.id);
		},

		// return the file list for this torrent
		getFileList: function() {
			return this.getTorrent().get('file');
		},

		// return the list of peers for this torrent
		getPeerList: function() {
			return this.getTorrent().get('peer');
		},

		// return the properties for this torrent
		getProperties: function() {
			return this.getTorrent().get('properties');
		},

		// returns the value of a property for this torrent
		getProperty: function(property) {
			return this.getProperties().get(property);
		},

		// returns a specific file in this torrent
		getFile: function(filename) {
			return this.getFileList().get(filename);
		},

		// returns the file properties for a given file of this torrent
		getFileProperties: function(filename) {
			return this.getFile(filename).get('properties');
		},

		// returns the value of a property for a given file in this torrent
		getFileProperty: function(filename, property) {
			return this.getFileProperties(filename).get(property);
		},

	});



	/********************************
	 * VIEW: The 'main 'application *
	 ********************************/
	var MyTorqueApp = Backbone.View.extend({

		// parent element
		el: 'body',

		// initialize view
		initialize: function() {
			this.render();
			_.bindAll(this, 'showTorrentDetails', 'render', 'renderTitle');
		},

		// shows details for a given torrent
		showTorrentDetails: function(torrent) {
			var detail_el = $(this.el).find('#details');
			this.torrentDetailsView = new TorrentDetailsView({
				el: $('#details'),
				id: torrent.id,
				model: torrent,
			});
		},

		// render view
		render: function() {
			$(this.el).html('<div class="container">'
			               +'  <div class="row clearfix">'
			               +'    <div id="title" class="col-md-12 column">'
			               +'    </div>'
			               +'    <div id="list" class="col-md-12 column">'
			               +'    </div>'
			               +'    <div id="details" class="col-md-12 column">'
			               +'    </div>'
			               +'  </div>'
			               +'</div>');
			this.renderTitle();
			var torrentListView = new TorrentListView({el: $('#list')});
			torrentListView.on('showTorrentDetails', this.showTorrentDetails);
			return this;
		},

		// render title
		renderTitle: function() {
			$('#title').html('<h3 class="text-muted">Btapp.js Evaluation</h3>');
		},

	});


	/*************************************************************
	 * VIEW: Torrent List View (represents the list of torrents) *
	 *************************************************************/
	var TorrentListView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// initialize view
		initialize: function() {
			_.bindAll(this, 'render', 'showTorrentDetails', 'setupTorrents', 'addTorrent', 'removeTorrent');
			btapp.on('add:torrent', this.setupTorrents);
			this.render();
		},

		// render view
		render: function() {
			$(this.el).html('<ul id="torrentList" class="list-unstyled"></ul>');
			return this;
		},

		// setup torrent list events
		setupTorrents: function(btapp_torrent_list) {
			btapp_torrent_list.on('add', this.addTorrent);
			btapp_torrent_list.on('remove', this.removeTorrent);
		},

		showTorrentDetails: function(id) {
			this.trigger('showTorrentDetails', id);
		},

		// handle addition of torrent
		addTorrent: function(btapp_torrent) {
			$('#torrentList').append('<li id="summary-'+btapp_torrent.id+'" class="torrent-summary"></li>');
			var summaryView = new TorrentSummaryView({
				id: btapp_torrent.id,
				el: $('#torrentList'),
			});
			summaryView.on('click', this.showTorrentDetails);
			summaryView.clickHandler();
		},

		// handle removal of torrent
		removeTorrent: function(btapp_torrent) {
			log("Torrent removed: " + btapp_torrent.id);
		},

	});



	/********************************************************************
	 * VIEW: Torrent Summary (represents a row in the list of torrents) *
	 ********************************************************************/
	var TorrentSummaryView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// torrend id <OVERRIDE>
		id: undefined,

		// torrent model
		model: undefined, // populated on initialization

		initialize: function() {
			_.bindAll(this, 'clickHandler', 'setupEvents', 'render', 'renderProgressBar', 'unrender', 'updateProgress');
			this.model = new TorrentReference({id: this.id});
			this.setupEvents();
			this.render();
		},

		// setup events
		setupEvents: function() {
			this.model.getProperties().on('change:progress', this.updateProgress);
			btapp.get('torrent').on('remove', this.unrender);
			$(this.el).click(_.bind(this.clickHandler, this));
		},

		// handle click events
		clickHandler: function() {
			this.trigger('click', this.model);
		},

		// render view
		render: function() {
			var name = this.model.getProperty('name');
			$(this.el).html('<div class="progress"></div>');
			this.renderProgressBar();
			return this;
		},

		// render progress bar
		renderProgressBar: function() {
			var name = this.model.getProperty('name');
			var progress = this.model.getProperty('progress');
			var percentage = progress/10;
			$(this.el).find(".progress").html(
				'<div class="progress-bar progress-bar-info" role="progressbar" aria-valuenow="'+progress+'" aria-valuemin="0" aria-valuemax="1000" style="width:'+percentage+'%"></div>');
			$(this.el).find(".progress").append('<p class="progress-label">'+name+'</p>');
			return this;
		},

		// unrender view
		unrender: function() {
			$(this.el).remove();
			return this;
		},

		// update torrent progress view
		updateProgress: function(properties, progress) {
			this.renderProgressBar();
		},

	});



	/******************************************************************
	 * VIEW: Torrent Details (shows details about a specific torrent) *
	 ******************************************************************/
	var TorrentDetailsView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// torrent id <OVERRIDE>
		id: undefined,

		// initialize view
		initialize: function() {
			_.bindAll(this, 'setChoice', 'render');
			this.render();
			this.currentView = new TorrentGeneralDetailsView({el: $('.well'), model: this.model});
		},

		// sets current active choice (visual effect only)
		setChoice: function(choice) {
			this.currentView.undelegateEvents();
			this.currentView.remove();
			$(this.el).append('<div class="well"></div>');
			$(".nav-tabs").children('li').each(function() {
				$(this).removeClass('active');
			});
			$(this.el).find(choice).addClass('active');
		},

		// render view
		render: function() {
			$(this.el).html('<ul class="nav nav-tabs"></ul>');
			$(this.el).append('<div class="well"></div>');

			// general tab
			$(this.el).find('.nav-tabs').append('<li id="general" class="active"><a>General</a></li>');
			$(this.el).find('#general').click(_.bind(function() {
				this.setChoice('#general');
				this.currentView = new TorrentGeneralDetailsView({el: $('.well'), model: this.model});
			}, this));

			// status tab
			$(this.el).find('.nav-tabs').append('<li id="status"><a>Status</a></li>');
			$(this.el).find('#status').click(_.bind(function() {
				this.setChoice('#status');
				this.currentView = new TorrentStatusDetailsView({el: $('.well'), model: this.model});
			}, this));

			// piece log tab
			$(this.el).find('.nav-tabs').append('<li id="piecelog"><a>Piece Log</a></li>');
			$(this.el).find('#piecelog').click(_.bind(function() {
				this.setChoice('#piecelog');
				this.currentView = new TorrentPieceDetailsView({el: $('.well'), model: this.model});
			}, this));
	
			// speed log tab
			$(this.el).find('.nav-tabs').append('<li id="speedlog"><a>Speed Log</a></li>');
			$(this.el).find('#speedlog').click(_.bind(function() {
				this.setChoice('#speedlog');
				this.currentView = new TorrentSpeedDetailsView({el: $('.well'), model: this.model});
			}, this));
		}

	});



	/**************************************************************************
	 * VIEW: Torrent General Details (shows basic information about a torrent *
	 **************************************************************************/
	var TorrentGeneralDetailsView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// torrent <OVERRIDE>
		model: undefined,

		// initialize view
		initialize: function() {
			_.bindAll(this, 'render');
			this.render();
		},

		addPanel: function(key, value) {
			$(this.el).append(
				'<div class="panel panel-default">'+
					'<div class="panel-heading">'+
						'<h3 class="panel-title">'+key+'</h3>'+
					'</div>'+
					'<div class="panel-body">'+value+'</div>'+
				'</div>');
		},

		// render view
		render: function() {
			$(this.el).empty();
			this.addPanel('Hash', this.model.getTorrent().get('id'));
			this.addPanel('Added on', humanTime(parseInt(this.model.getProperty('added_on')*1000)));
			this.addPanel('Information collection started on', humanTime(Date.parse(this.model.creationTime)));
		},

	});



	/**************************************************************************
	 * VIEW: Torrent Status Details (shows basic information about a torrent *
	 **************************************************************************/
	var TorrentStatusDetailsView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// torrent <OVERRIDE>
		model: undefined,

		// initialize view
		initialize: function() {
			_.bindAll(this, 'render');
			this.model.getProperties().on('change:availability', _.bind(this.render, this));
			this.model.getProperties().on('change:downloaded', _.bind(this.render, this));
			this.model.getProperties().on('change:remaining', _.bind(this.render, this));
			this.model.on('newpieces', _.bind(this.render, this));
			this.render();
		},

		addPanel: function(key, value) {
			$(this.el).append(
				'<div class="panel panel-default">'+
					'<div class="panel-heading">'+
						'<h3 class="panel-title">'+key+'</h3>'+
					'</div>'+
					'<div class="panel-body">'+value+'</div>'+
				'</div>');
		},

		// render view
		render: function() {
			var numPieces = this.model.numPieces();
			var size = this.model.getProperty('size');
			var pieceSize = roundNextPowerOfTwo(size/numPieces);
			$(this.el).empty();
			this.addPanel('Size', humanSize(size));
			this.addPanel('Downloaded / Remaining', humanSize(this.model.getProperty('downloaded')) + ' / ' + humanSize(this.model.getProperty('remaining')));
			this.addPanel('Num Pieces', numPieces);
			this.addPanel('Piece Size', humanSize(pieceSize) + '<br/>Assumes piece size is power of two, otherwise the value reported is incorrect.');
			this.addPanel('Availability', (this.model.getProperty('availability')/100) + '%');
		},

	});



	/********************************************************************
	 * VIEW: Torrent Piece Log (shows the log of pieces being commited) *
	 ********************************************************************/
	var TorrentPieceDetailsView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// torrent <OVERRIDE>
		model: undefined,

		// initialize view
		initialize: function() {
			_.bindAll(this, 'commaExportData', 'render');
			this.render();
			this.model.on('newpieces', _.bind(function() {
				this.updateChart('PieceProgress', [
					{ label: 'total pieces',       data: this.model.totalPiecesLog },
					{ label: 'consecutive pieces', data: this.model.consecutivePiecesLog },
					{ label: 'nonzero pieces',     data: this.model.nonzeroPiecesLog },
				], { yaxis: { max: this.model.numPieces() } });
				this.updatePanel('total', this.model.numPieces());
				this.updatePanel('have', this.model.totalPieces);
				this.updatePanel('consecutive', this.model.consecutivePieces);
				this.updatePanel('dump_consecutive', this.commaSeparateData(this.model.consecutivePiecesLog, 'time', 'consecutive'));
				this.updatePanel('dump_total', this.commaSeparateData(this.model.totalPiecesLog, 'time', 'total'));
			}, this));
		},

		addPanel: function(key, value) {
			$(this.el).append(
				'<div id="'+key+'"class="panel panel-default">'+
					'<div class="panel-heading">'+
						'<h3 class="panel-title">'+key+'</h3>'+
					'</div>'+
					'<div class="panel-body" width="100%">'+value+'</div>'+
				'</div>');
		},

		updatePanel: function(key, value) {
			$(this.el).find('#'+key).find('.panel-body').html(value);
		},

		addChart: function(key, data) {
			this.addPanel(key, '');
			var width = $(this.el).find('#'+key).find('.panel-body').width();
			var height = 500;
			$(this.el).find('#'+key).find('.panel-body').width(width);
			$(this.el).find('#'+key).find('.panel-body').height(height);
			this.updateChart(key, data);
		},

		updateChart: function(key, data, userOptions) {
			var options = {
				legend: { position: 'se' },
				xaxis:  { min: 0, mode: 'time' },
				yaxis:  { min: 0 },
				series: { lines: {show: true}, points: {show: false} }
			};
			$.extend(true, options, userOptions);
			$(this.el).find('#'+key).find('.panel-body').plot(data, options);
		},

		// export data
		commaSeparateData: function(data, xname, yname) {
			return xname + ',' + yname + '<br/>' + data.map(function(el) {
				return el.toString()
			}).join('<br/>');
		},

		// render view
		render: function() {
			$(this.el).empty();
			this.addPanel('total', this.model.numPieces());
			this.addPanel('have', this.model.totalPieces);
			this.addPanel('sequential', this.model.consecutivePieces);
			this.addChart('PieceProgress', [
				{ label: 'total pieces',       data: this.model.totalPiecesLog },
				{ label: 'consecutive pieces', data: this.model.consecutivePiecesLog,},
				{ label: 'nonzero pieces',     data: this.model.nonzeroPiecesLog },
			],
			{ yaxis: { max: this.model.numPieces() } });
			this.addPanel('dump_consecutive', this.commaSeparateData(this.model.consecutivePiecesLog, 'time', 'consecutive'));
			this.addPanel('dump_total', this.commaSeparateData(this.model.totalPiecesLog, 'time', 'total'));
			
		},

	});



	/*************************************************************
	 * VIEW: Torrent Speed Log (shows the log of transfer speed) *
	 *************************************************************/
	var TorrentSpeedDetailsView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// torrent <OVERRIDE>
		model: undefined,

		// initialize view
		initialize: function() {
			_.bindAll(this, 'render');
			this.render();
			var updateFunction = _.bind(function() {
				this.updatePanel('download', this.model.downloadSpeed);
				this.updatePanel('upload', this.model.uploadSpeed);
				this.updateChart('Speed', [
					{ label: 'download', data: this.model.downloadSpeedLog },
					{ label: 'upload',   data: this.model.uploadSpeedLog,},
				]);
				this.updatePanel('dump_download', this.commaSeparateData(this.model.downloadSpeedLog, 'time', 'downspeed'));
				this.updatePanel('dump_upload', this.commaSeparateData(this.model.uploadSpeedLog, 'time', 'upspeed'));
			}, this);
			this.model.getProperties().on('change:download_speed', updateFunction);
			this.model.getProperties().on('change:upload_speed', updateFunction);
		},

		addPanel: function(key, value) {
			$(this.el).append(
				'<div id="'+key+'"class="panel panel-default">'+
					'<div class="panel-heading">'+
						'<h3 class="panel-title">'+key+'</h3>'+
					'</div>'+
					'<div class="panel-body" width="100%">'+value+'</div>'+
				'</div>');
		},

		updatePanel: function(key, value) {
			$(this.el).find('#'+key).find('.panel-body').html(value);
		},

		addChart: function(key, data) {
			this.addPanel(key, '');
			var width = $(this.el).find('#'+key).find('.panel-body').width();
			var height = 500;
			$(this.el).find('#'+key).find('.panel-body').width(width);
			$(this.el).find('#'+key).find('.panel-body').height(height);
			this.updateChart(key, data);
		},

		updateChart: function(key, data) {
			$(this.el).find('#'+key).find('.panel-body').plot(data, {
				legend: { position: "ne", },
				xaxis:  { min: 0, mode: "time" },
				yaxis:  { min: 0, tickFormatter: speedTickFormatter, },
				series: {
					lines:  {show: true},
					points: {show: false},
				},
			});
		},

		// export data
		commaSeparateData: function(data, xname, yname) {
			return xname + ', ' + yname + '<br/>' + data.map(function(el) {
				return el.toString()
			}).join('<br/>');
		},

		// render view
		render: function() {
			$(this.el).empty();
			this.addPanel('download', this.model.downloadSpeed);
			this.addPanel('upload', this.model.uploadSpeed);
			this.addChart('Speed', [
				{ label: 'download', data: this.model.downloadSpeedLog },
				{ label: 'upload',   data: this.model.uploadSpeedLog,},
			]);
			this.addPanel('dump_download', this.commaSeparateData(this.model.downloadSpeedLog, 'time', 'downspeed'));
			this.addPanel('dump_upload', this.commaSeparateData(this.model.uploadSpeedLog, 'time', 'upspeed'));
		},

	});



	window.btapp = new Btapp();
	btapp.connect();
	window.myApp = new MyTorqueApp();

});
