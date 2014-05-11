$(function() {


	// helper function: returns a string with the current datetime
	function currentHumanTime() {
		var date = new Date(Date.now());
		var Y = date.getFullYear();
		var M = date.getMonth() + 1;
		M = ((M<10) ? "0"+M : M);
		var D = date.getDay();
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
		oldPieces: undefined,

		// initialize the model
		initialize: function() {
			_.bindAll(this, 'setupLogPieces', 'logPieces', 'getTorrent', 'getFileList', 'getPeerList', 'getProperties', 'getProperty', 'getFile', 'getFileProperties', 'getFileProperty');
			log('added on: ' + this.getProperty('added_on'));
			this.setupLogPieces();
		},

		// setup logging of piece retrievals
		setupLogPieces: function() {
			this.getTorrent().pieces().then(_.bind(function(data) {
				this.pieces = data
			}, this));
			this.piecesTimer = setInterval(_.bind(function() {
				this.getTorrent().pieces().then(_.bind(this.logPieces, this));
			}, this), 1000);
		},

		// log piece retrievals
		logPieces: function(data) {
			this.oldPieces = this.pieces;
			this.pieces = data;
			var newpieces_str = "";
			for(var i=0; i<data.length; i+=2) {
				var oldData = this.oldPieces.slice(i, i+2);
				var newData = data.slice(i, i+2);
				if(!_.isEqual(oldData, newData)) {
					newpieces_str += i/2 + " ";
				}
			}
			if(newpieces_str != "") {
				log("pieces: " + newpieces_str);
			}
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
			log("PRINTING MODEL");
			console.log(torrent);
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
			$('#title').html('<h3 class="text-muted">My Torque App</h3>');
		},

	});


	/*************************************************************
	 * VIEW: Torrent List View (represents the list of torrents) *
	 *************************************************************/
	// View: list of torrents
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
		torrent: undefined, // populated on initialization

		initialize: function() {
			_.bindAll(this, 'clickHandler', 'setupEvents', 'render', 'renderProgressBar', 'unrender', 'updateProgress');
			this.torrent = new TorrentReference({id: this.id});
			log("should have torrent already no?");
			log("got xpto? " + this.xpto);
			this.setupEvents();
			this.render();
		},

		// setup events
		setupEvents: function() {
			this.torrent.getProperties().on('change:progress', this.updateProgress);
			btapp.get('torrent').on('remove', this.unrender);
			$(this.el).click(_.bind(this.clickHandler, this));
		},

		// handle click events
		clickHandler: function() {
			log("click happened. this is what i will send: ");
			console.log(this.torrent);
			this.trigger('click', this.torrent);
		},

		// render view
		render: function() {
			var name = this.torrent.getProperty('name');
			$(this.el).html('<div class="progress"></div>');
			this.renderProgressBar();
			return this;
		},

		// render progress bar
		renderProgressBar: function() {
			var name = this.torrent.getProperty('name');
			var progress = this.torrent.getProperty('progress');
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



	/*****************************************************************
	 * VIEW: Torrent Details (shows details about a specific torrent *
	 *****************************************************************/
	// View: torrent details view (below the list of torrents)
	var TorrentDetailsView = Backbone.View.extend({

		// parent element
		el: $('body'),

		// torrent id <OVERRIDE>
		id: undefined,

		// initialize view
		initialize: function() {
			_.bindAll(this, 'render');
			this.render();
		},

		// render view
		render: function() {
			$(this.el).html('<p>hello world '+this.id+'</p>');
			$(this.el).append('<p>'+JSON.stringify(this.model)+'</p>');
			
		}

	});



	window.btapp = new Btapp();
	btapp.connect();
	window.myApp = new MyTorqueApp();

});
