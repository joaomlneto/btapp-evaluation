jQuery(function() {

	var downloadUrl = 'http://featuredcontent.utorrent.com/torrents/CountingCrows-BitTorrent.torrent';

	// connect to btapp
	window.btapp = new Btapp();
	btapp.connect();

	// add module initialized
/*	btapp.on('add:add', function(add) {
		logInfo("add module initialized");
		window.torrent = new Torrent(btapp, downloadUrl);
		torrent.remove();
		torrent.add();
	});
*/

	

});
