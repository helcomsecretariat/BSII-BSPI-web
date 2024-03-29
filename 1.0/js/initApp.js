define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo/on",
	"dojo/dom",
	"dijit/layout/TabContainer",
	"dijit/layout/ContentPane",
	"app/js/startupWindow",
	"app/js/mapManager",
	"dojo/domReady!"
], function(
	declare, lang, on, dom,
	TabContainer,
	ContentPane,
	startupWindow, mapManager
) {
	return declare(null, {
		mM: null,
		loaded: false,

		constructor: function() {
			on(dijit.byId("cpi"), "show", function() {
				document.getElementById("leftPane").style.width = "100%";
				dijit.byId("mainWindow").resize();
			});

			on(dijit.byId("cpc"), "show", function() {
				document.getElementById("leftPane").style.width = "50%";
				dijit.byId("mainWindow").resize();
			});

			on(dijit.byId("cpl"), "show", function() {
				document.getElementById("leftPane").style.width = "25%";
				dijit.byId("mainWindow").resize();
			});

			fetch(windowUrl + appVersion + "/config/config.json")
				.then(lang.hitch(this, function(response) {
					return response.text();
				}))
				.then(lang.hitch(this, function(text) {
					document.getElementById("loadingCover").style.display = "none";
					console.log("config fetched");
					let resp = JSON.parse(text);
					this.mM = new mapManager({mapNode: "map", services: resp.services, ecConfig: resp.EC, plConfig: resp.PL});
				}));
		}
	});
});
