define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo",
	"dojo/on",
	"dojo/dom",
	"dojo/dom-style",
	"dojo/_base/array", "dojo/dom-construct",
	"dijit/Tooltip", "dojo/store/Memory","dijit/tree/ObjectStoreModel", "dijit/Tree",
	"esri/tasks/IdentifyTask", "esri/tasks/IdentifyParameters",
	"app/js/utils"
], function(
	declare,
	lang,
	dojo,
	on,
	dom,
	domStyle,
	array, domConstruct,
	Tooltip, Memory, ObjectStoreModel, Tree,
	IdentifyTask, IdentifyParameters,
	utils
){
	return declare(null, {
		utils: null,
		map: null,
		ecConfig: null,
		plConfig: null,
		layerService: null,
		legendInfo: [],
		tree: null,
    store: null,
    data: [{ id: 'layerlist', leaf: false}],
		identify : null,

		constructor: function(params) {
			this.map = params.map;
			this.ecConfig = params.ecConfig;
			this.plConfig = params.plConfig;
			this.utils = new utils();
			this.postCreate();
		},

		postCreate: function() {
			this.layerService = this.map.getLayer("ec_pl");
			let idp = new IdentifyParameters();
			idp.tolerance = 6;
			idp.returnGeometry = true;
			idp.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;
			idp.layerIds = [];

			this.identify = {
				"task": new IdentifyTask(this.layerService.url),
				"params": idp
			};

			this.getLegendInfo();
			this.createDataArray();
		},

		clean: function() {

		},

		getLegendInfo: function() {
      let requestHandle = null;
			fetch(this.layerService.url+"/legend?f=pjson")
				.then(lang.hitch(this, function(response) {
					return response.text();
				}))
				.then(lang.hitch(this, function(text) {
					let resp = JSON.parse(text);

					array.forEach(resp.layers, lang.hitch(this, function(layer) {
						this.legendInfo[layer.layerId] = layer.legend;
					}));
				}));
    },

		createDataArray: function() {
			array.forEach(this.layerService.layerInfos, lang.hitch(this, function(lyrInfo) {
				// check if layer is a leaf
				let isLeaf = false;
				if (lyrInfo.subLayerIds) {
					isLeaf = false;
				}
				else {
					isLeaf = true;
				}
				// add all levels and set parent levels
				if (lyrInfo.parentLayerId === -1) {
					this.data.push({id: "ec_pl_"+lyrInfo.id, parent: "layerlist", name: lyrInfo.name, topGroup: false, leaf: isLeaf, visibilityId: lyrInfo.id});
				}
				else {
					this.data.push({id: "ec_pl_"+lyrInfo.id, parent: "ec_pl_"+lyrInfo.parentLayerId, name: lyrInfo.name, code: lyrInfo.name.split(":")[0], topGroup: false, leaf: isLeaf, visibilityId: lyrInfo.id});
				}
			}));
			this.createTree();
    },

		createTree: function() {
      let mapa = this.map;
			let that = this;
      let legendInfo = this.legendInfo;
			let serviceLayer = this.layerService;
			let identify = this.identify;
      let myStore = new Memory({
        data: this.data,
        getChildren: function(object){
            return this.query({parent: object.id});
        }
      });
      this.store = myStore;
      let myModel = new ObjectStoreModel({
        store: myStore,
        query: {id: 'layerlist'}
      });

      this.tree = new Tree({
        model: myModel,
        showRoot: false,
        getIconClass:function(item, opened){

        },
        getNodeFromItem: function (id) {
          return this._itemNodesMap[ id ][0];
        },

        _createTreeNode: function(args) {
          let tnode = new dijit._TreeNode(args);
          tnode.labelNode.innerHTML = args.label;
          // if tree node is a data layer
          if (tnode.item.leaf) {
            dojo.destroy(tnode.expandoNode);
            let cb = new dijit.form.CheckBox();
            cb.placeAt(tnode.contentNode, "first");
            // metadata button
            let metadataButton = domConstruct.create("div", { "class": "metadataButton" }, tnode.contentNode, "last");
            new Tooltip({
              connectId: [metadataButton],
              showDelay: 10,
              label: "View metadata"
            });
            // set sublayers label width depending on sublayer level in the tree
            let rowNodePadding = domStyle.get(tnode.rowNode, "padding-left");
            let labelNodeWidth = 258 - rowNodePadding;
            domStyle.set(tnode.labelNode, {"width": labelNodeWidth+"px"});
            // create legend node
            let legendContainerDiv = domConstruct.create("div", { "style": "display: none;" }, tnode.rowNode, "last");
            let lIs = legendInfo[tnode.item.visibilityId];
            // create legend row
            array.forEach(lIs, lang.hitch(this, function(lI) {
              let legendRow = domConstruct.create("div", { "class": "legendRow" }, legendContainerDiv, "last");

              legendRow.innerHTML = lI.label;
              let legendRowStyle = {
                "background-image": 'url("'+serviceLayer.url+'/'+tnode.item.visibilityId+'/images/' + lI.url+'")',
                "line-height": lI.height+"px",
                "padding-left": lI.width+5+"px",
                "margin-left": "22px",
                "width": 238-rowNodePadding+"px"
              };
              domStyle.set(legendRow, legendRowStyle);
            }));
            let attributeTable = null;
            // on sublayer check box click
            on(cb, "change", function(checked){
              let visible = serviceLayer.visibleLayers;
              if (checked) {
                that.addingLayer = true;
                // make sublayer visible
                visible.push(tnode.item.visibilityId);
                serviceLayer.setVisibleLayers(visible);
                // show legend
                domStyle.set(legendContainerDiv, "display", "block");
                // add sublayer for identify task
                identify.params.layerIds.push(tnode.item.visibilityId);
              }
              else {
                // hide sublayer
                let index = visible.indexOf(tnode.item.visibilityId);
                if (index > -1) {
                  visible.splice(index, 1);
                  serviceLayer.setVisibleLayers(visible);
                  // remove sublayer for identify task
                  identify.params.layerIds.splice(index, 1);
                }
                // hide legend
                domStyle.set(legendContainerDiv, "display", "none");
              }
            });
            tnode.checkBox = cb;

            on(metadataButton, "click", function(){
              let metadataURL = "http://metadata.helcom.fi/geonetwork/srv/eng/catalog.search#/metadata/";
							if (tnode.item.code.startsWith("EC_")) {
								metadataURL += that.ecConfig[tnode.item.code]["metadata"];
							}
							else if (tnode.item.code.startsWith("PL_")) {
								metadataURL += that.plConfig[tnode.item.code]["metadata"];
							}
							window.open(metadataURL, '_blank');
            });
          }
          return tnode;
        }
      });
			this.tree.placeAt(dojo.byId("layerListTreeID"));
      this.tree.startup();
    }
	});
});
