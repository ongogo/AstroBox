/*
 *  (c) Daniel Arroyo. 3DaGoGo, Inc. (daniel@astroprint.com)
 *
 *  Distributed under the GNU Affero General Public License http://www.gnu.org/licenses/agpl.html
 */

var SettingsPage = Backbone.View.extend({
	parent: null,
	initialize: function(params) {
		this.parent = params.parent;
	},
	show: function() {
		this.parent.$el.find('.settings-page').addClass('hide');
		this.$el.removeClass('hide');
	}
});

/***********************
* Printer - Connection
************************/

var PrinterConnectionView = SettingsPage.extend({
	el: '#printer-connection',
	template: _.template( $("#printer-connection-settings-page-template").html() ),
	settings: null,
	initialize: function(params)
	{
		this.listenTo(app.socketData, 'change:printer', this.printerStatusChanged );

		SettingsPage.prototype.initialize.call(this, params);
	},
	show: function() {
		//Call Super
		SettingsPage.prototype.show.apply(this);

		if (!this.settings) {
			this.getInfo();
		} else {
			this.render();
		}
	},
	getInfo: function()
	{
		this.$('a.retry-ports i').addClass('animate-spin');
		$.getJSON(API_BASEURL + 'settings/printer', null, _.bind(function(data) {
			if (data.serial) {
				this.settings = data;
				this.render(); // This removes the animate-spin from the link
			} else {
				noty({text: "No serial settings found.", timeout: 3000});
			}
		}, this))
		.fail(function() {
			noty({text: "There was an error getting serial settings.", timeout: 3000});
			this.$('a.retry-ports i').removeClass('animate-spin');
		})
	},
	render: function() 
	{
		this.$('form').html(this.template({ 
			settings: this.settings
		}));

		this.printerStatusChanged(app.socketData, app.socketData.get('printer'));

		this.delegateEvents({
			'change #settings-baudrate': 'saveConnectionSettings',
			'change #settings-serial-port': 'saveConnectionSettings',
			'click a.retry-ports': 'retryPortsClicked',
			'click .loading-button.test-connection button': 'testConnection'
		});
	},
	retryPortsClicked: function(e)
	{
		e.preventDefault();
		this.getInfo();
	},
	saveConnectionSettings: function(e) {
		var connectionData = {};

		_.each(this.$('form').serializeArray(), function(e){
			connectionData[e.name] = e.value;
		});

		if (connectionData.port) {
			this.$('.loading-button.test-connection').addClass('loading');
			this.$('.connection-status').removeClass('failed connected').addClass('connecting');
	        $.ajax({
	            url: API_BASEURL + "connection",
	            type: "POST",
	            dataType: "json",
	            contentType: "application/json; charset=UTF-8",
	            data: JSON.stringify({
		            "command": "connect",
		            "driver": connectionData.driver,
		            "port": connectionData.port,
		            "baudrate": connectionData.baudrate ? parseInt(connectionData.baudrate) : null,
		            "autoconnect": true,
		            "save": true
		        })
	        })
			.fail(function(){
				noty({text: "There was an error testing connection settings.", timeout: 3000});
			});
		}
	},
	printerStatusChanged: function(s, value)
	{
		this.$('.connection-status').removeClass('connecting failed connected').addClass(value.status);

		if (value.status != 'connecting') {
			this.$('.loading-button.test-connection').removeClass('loading');
		}
	},
	testConnection: function(e)
	{
		e.preventDefault();
		this.saveConnectionSettings();
	}
});

/***********************
* Printer - Profile
************************/

var PrinterProfileView = SettingsPage.extend({
	el: '#printer-profile',
	template: _.template( $("#printer-profile-settings-page-template").html() ),
	settings: null,
	initialize: function(params)
	{
		SettingsPage.prototype.initialize.call(this, params);

		this.settings = app.printerProfile;
	},
	show: function() {
		//Call Super
		SettingsPage.prototype.show.apply(this);

		this.render();
	},
	render: function() {
		this.$el.html(this.template({ 
			settings: this.settings.toJSON()
		}));

		this.$el.foundation();

		this.$('#extruder-count').val(this.settings.get('extruder_count'));

		this.delegateEvents({
			"invalid.fndtn.abide form": 'invalidForm',
			"valid.fndtn.abide form": 'validForm',
			"change input[name='heated_bed']": 'heatedBedChanged',
			"change select[name='driver']": 'driverChanged'
		});
	},
	heatedBedChanged: function(e)
	{
		var target = $(e.currentTarget);
		var wrapper = this.$('.input-wrapper.max_bed_temp');

		if (target.is(':checked')) {
			wrapper.removeClass('hide');
		} else {
			wrapper.addClass('hide');
		}
	},
	driverChanged: function(e)
	{
		var target = $(e.currentTarget);
		var wrapper = this.$('.input-wrapper.cancel-gcode');

		if (target.val() == 's3g') {
			wrapper.addClass('hide');
		} else {
			wrapper.removeClass('hide');
		}		
	},
	invalidForm: function(e)
	{
	    if (e.namespace !== 'abide.fndtn') {
	        return;
	    }

		noty({text: "Please check your errors", timeout: 3000});
	},
	validForm: function(e) {
	    if (e.namespace !== 'abide.fndtn') {
	        return;
	    }

	    var form = this.$('form');
	    var loadingBtn = form.find('.loading-button');
		var attrs = {};

		loadingBtn.addClass('loading');

		form.find('input, select, textarea').each(function(idx, elem) {
			var value = null;
			var elem = $(elem);

			if (elem.is('input[type="radio"], input[type="checkbox"]')) {
				value = elem.is(':checked');
			} else {
				value = elem.val();
			}

			attrs[elem.attr('name')] = value;
		});

		this.settings.save(attrs, {
			patch: true,
			success: _.bind(function() {
				noty({text: "Profile changes saved", timeout: 3000, type:"success"});
				loadingBtn.removeClass('loading');
				//Make sure we reload next time we load this tab
				this.parent.subviews['printer-connection'].settings = null;
			}, this),
			error: function() {
				noty({text: "Failed to save printer profile change", timeout: 3000});
				loadingBtn.removeClass('loading');
			}
		});			
	}
});

/*************************
* Internet - Connection
**************************/

var InternetConnectionView = SettingsPage.extend({
	el: '#internet-connection',
	template: _.template( $("#internet-connection-settings-page-template").html() ),
	networksDlg: null,
	settings: null,
	events: {
		'click .loading-button.start-hotspot button': 'startHotspotClicked',
		'click .loading-button.stop-hotspot button': 'stopHotspotClicked',
		'click .loading-button.list-networks button': 'listNetworksClicked',
		'change .hotspot-off input': 'hotspotOffChanged'
	},
	initialize: function(params) {
		SettingsPage.prototype.initialize.apply(this, arguments);

		this.networksDlg = new WiFiNetworksDialog({parent: this});
	},
	show: function() {
		//Call Super
		SettingsPage.prototype.show.apply(this);

		if (!this.settings) {
			$.getJSON(API_BASEURL + 'settings/internet', null, _.bind(function(data) {
				this.settings = data;
				this.render();
			}, this))
			.fail(function() {
				noty({text: "There was an error getting WiFi settings.", timeout: 3000});
			});
		}
	},
	render: function() {
		this.$el.html(this.template({ 
			settings: this.settings
		}));
	},
	connect: function(id, username, password) {
		var promise = $.Deferred();

		$.ajax({
			url: API_BASEURL + 'settings/internet/active', 
			type: 'POST',
			contentType: 'application/json',
			dataType: 'json',
			data: JSON.stringify({id: id, username: username, password: password})
		})
			.done(_.bind(function(data) {
				if (data.name) {
					var connectionCb = null;

					//Start Timeout 
					var connectionTimeout = setTimeout(function(){
						connectionCb.call(this, {status: 'failed', reason: 'timeout'});
					}, 70000); //1 minute

					connectionCb = function(connectionInfo){
						switch (connectionInfo.status) {
							case 'disconnected':
							case 'connecting':
								//Do nothing. the failed case should report the error
							break;

							case 'connected':
								app.eventManager.off('astrobox:InternetConnectingStatus', connectionCb, this);
								noty({text: "Your "+PRODUCT_NAME+" is now connected to "+connectionInfo.info.name+".", type: "success", timeout: 3000});
								this.settings.networks['wireless'] = connectionInfo.info;
								this.render();
								promise.resolve();
								clearTimeout(connectionTimeout);
							break;

							case 'failed':
								app.eventManager.off('astrobox:InternetConnectingStatus', connectionCb, this);
								if (connectionInfo.reason == 'no_secrets') {
									message = "Invalid password for "+data.name+".";
								} else {
									message = "Unable to connect to "+data.name+".";
								}
								promise.reject(message);
								clearTimeout(connectionTimeout);
								break;

							default:
								app.eventManager.off('astrobox:InternetConnectingStatus', connectionCb, this);
								promise.reject("Unable to connect to "+data.name+".");
								clearTimeout(connectionTimeout);
						} 
					};

					app.eventManager.on('astrobox:InternetConnectingStatus', connectionCb, this);

				} else if (data.message) {
					noty({text: data.message, timeout: 3000});
					promise.reject()
				}
			}, this))
			.fail(_.bind(function(){
				noty({text: "There was an error saving setting.", timeout: 3000});
				promise.reject();
			}, this));

		return promise;
	},
	startHotspotClicked: function(e) {
		var el = $(e.target).closest('.loading-button');

		el.addClass('loading');

		$.ajax({
			url: API_BASEURL + "settings/internet/hotspot",
			type: "POST",
			success: _.bind(function(data, code, xhr) {
				noty({text: 'Your '+PRODUCT_NAME+' has created a hotspot. Connect to <b>'+this.settings.hotspot.name+'</b>.', type: 'success', timeout:3000});
				this.settings.hotspot.active = true;
				this.render();
			}, this),
			error: function(xhr) {
				noty({text: xhr.responseText, timeout:3000});
			},
			complete: function() {
				el.removeClass('loading');
			}
		});
	},
	stopHotspotClicked: function(e) {
		var el = $(e.target).closest('.loading-button');

		el.addClass('loading');

		$.ajax({
			url: API_BASEURL + "settings/internet/hotspot",
			type: "DELETE",
			success: _.bind(function(data, code, xhr) {
				noty({text: 'The hotspot has been stopped', type: 'success', timeout:3000});
				this.settings.hotspot.active = false;
				this.render();
			}, this),
			error: function(xhr) {
				noty({text: xhr.responseText, timeout:3000});
			},
			complete: function() {
				el.removeClass('loading');
			}
		});
	},
	listNetworksClicked: function(e) {
		var el = $(e.target).closest('.loading-button');

		el.addClass('loading');

		$.getJSON(
			API_BASEURL + "settings/internet/wifi-networks",
			_.bind(function(data) {
				if (data.message) {
					noty({text: data.message});
				} else if (data.networks) {
					var self = this;
					this.networksDlg.open(_.sortBy(_.uniq(_.sortBy(data.networks, function(el){return el.name}), true, function(el){return el.name}), function(el){
						el.active = self.settings.networks.wireless && self.settings.networks.wireless.name == el.name;
						return -el.signal
					}));
				}
			}, this)
		).
		fail(function(){
			noty({text: "There was an error retrieving networks.", timeout:3000});
		}).
		complete(function(){
			el.removeClass('loading');
		});
	},
	hotspotOffChanged: function(e)
	{
		var target = $(e.currentTarget);

		$.ajax({
			url: '/api/settings/internet/hotspot',
			method: 'PUT',
			data: JSON.stringify({
				'hotspotOnlyOffline': target.is(':checked')
			}),
			contentType: 'application/json',
			dataType: 'json'
		}).
		fail(function(){
			noty({text: "There was an error saving hotspot option.", timeout: 3000});
		})
	}
});

var WiFiNetworkPasswordDialog = Backbone.View.extend({
	el: '#wifi-network-password-modal',
	events: {
		'click button.connect': 'connectClicked',
		'submit form': 'connect'
	},
	template: _.template($('#wifi-network-password-modal-template').html()),
	parent: null,
	initialize: function(params) {
		this.parent = params.parent;
	},
	render: function(wifiInfo)
	{
		this.$el.html( this.template({wifi: wifiInfo}) );
	},
	open: function(wifiInfo) {
		this.render(wifiInfo);
		this.$el.foundation('reveal', 'open', {
			close_on_background_click: false,
			close_on_esc: false	
		});
		this.$el.one('opened', _.bind(function() {
			this.$el.find('input.focus').focus();
		}, this));
	},
	connectClicked: function(e) {
		e.preventDefault();

		var form = this.$('form');
		form.submit();
	},
	connect: function(e) {
		e.preventDefault() 
		var form = $(e.currentTarget);

		var id = form.find('.network-id-field').val();
		var password = form.find('.network-password-field').val();
		var username = form.find('.network-username-field').val();
		var loadingBtn = this.$('button.connect').closest('.loading-button');
		var cancelBtn = this.$('button.cancel');

		loadingBtn.addClass('loading');
		cancelBtn.hide();

		this.parent.connect(id, username, password)
			.done(_.bind(function(){
				form.find('.network-password-field').val('');
				this.$el.foundation('reveal', 'close');
				loadingBtn.removeClass('loading');
				cancelBtn.show();
			}, this))
			.fail(_.bind(function(message){
				loadingBtn.removeClass('loading');
				cancelBtn.show();
				noty({text: message, timeout: 3000});
				this.$el.foundation('reveal', 'close');
			}, this));

		return false;
	}
});

var WiFiNetworksDialog = Backbone.View.extend({
	el: '#wifi-network-list-modal',
	networksTemplate: _.template( $("#wifi-network-modal-row").html() ),
	passwordDlg: null,
	parent: null,
	networks: null,
	initialize: function(params) {
		this.parent = params.parent;
	},
	open: function(networks) {
		var content = this.$el.find('.modal-content');
		content.empty();

		this.networks = networks;

		content.html(this.networksTemplate({ 
			networks: this.networks
		}));

		content.find('button').bind('click', _.bind(this.networkSelected, this));

		this.$el.foundation('reveal', 'open');
	},
	networkSelected: function(e) {
		e.preventDefault();

		var button = $(e.target);
	
		if (!this.passwordDlg) {
			this.passwordDlg = new WiFiNetworkPasswordDialog({parent: this.parent});
		}

		var network = this.networks[button.data('id')]

		if (network.secured) {
			this.passwordDlg.open(network);
		} else {
			var loadingBtn = button.closest('.loading-button');

			loadingBtn.addClass('loading');

			this.parent.connect(network.id, null)
				.done(_.bind(function(){
					this.$el.foundation('reveal', 'close');
					loadingBtn.removeClass('loading');
				}, this))
				.fail(function(message){
					noty({text: message, timeout: 3000});
					loadingBtn.removeClass('loading');
				});
		}
	}
});

/********************
* Software - Update
*********************/

var SoftwareUpdateView = SettingsPage.extend({
	el: '#software-update',
	events: {
		'click .loading-button.check button': 'onCheckClicked'
	},
	updateDialog: null,
	onCheckClicked: function(e)
	{
		var loadingBtn = this.$el.find('.loading-button.check');
		loadingBtn.addClass('loading');
		$.ajax({
			url: API_BASEURL + 'settings/software/check', 
			type: 'GET',
			dataType: 'json',
			success: _.bind(function(data) {
				if (!this.updateDialog) {
					this.updateDialog = new SoftwareUpdateDialog();
				}

				this.updateDialog.open(data);
			}, this),
			error: function(xhr) {
				if (xhr.status == 400) {
					noty({text: xhr.responseText, timeout: 3000});
				} else {
					noty({text: "There was a problem checking for new software.", timeout: 3000});
				}
			},
			complete: function() {
				loadingBtn.removeClass('loading');
			}
		});
	}
});

var SoftwareUpdateDialog = Backbone.View.extend({
	el: '#software-update-modal',
	data: null,
	contentTemplate: null,
	open: function(data)
	{
		if (!this.contentTemplate) {
			this.contentTemplate = _.template( $("#software-update-modal-content").html() )
		}

		this.data = data;

		var content = this.$el.find('.content');
		content.empty();
		content.html(this.contentTemplate({data: data, date_format:app.utils.dateFormat}));

		content.find('button.cancel').bind('click', _.bind(this.close, this));
		content.find('button.go').bind('click', _.bind(this.doUpdate, this));

		this.$el.foundation('reveal', 'open');
	},
	close: function()
	{
		this.$el.foundation('reveal', 'close');
	},
	doUpdate: function()
	{
		var loadingBtn = this.$el.find('.loading-button');
		loadingBtn.addClass('loading');
		$.ajax({
			url: API_BASEURL + 'settings/software/update', 
			type: 'POST',
			dataType: 'json',
			contentType: 'application/json',
			data: JSON.stringify({
				release_id: this.data.release.id
			}),
			success: function() {
				//reset the page to show updating progress
				location.reload();
			},
			error: function(xhr) {
				if (xhr.status == 400) {
					noty({text: xhr.responseText, timeout: 3000});
				} else {
					noty({text: "There was a problem updating to the new version.", timeout: 3000});
				}
				loadingBtn.removeClass('loading');
			}
		});
	}
});

/************************
* Software - Advanced
*************************/

var SoftwareAdvancedView = SettingsPage.extend({
	el: '#software-advanced',
	template: _.template( $("#software-advanced-content-template").html() ),
	resetConfirmDialog: null,
	sendLogDialog: null,
	clearLogDialog: null,
	settings: null,
	events: {
		'change #serial-logs': 'serialLogChanged'
	},
	initialize: function(params)
	{
		SettingsPage.prototype.initialize.apply(this, arguments);
		this.resetConfirmDialog = new ResetConfirmDialog();
		this.sendLogDialog = new SendLogDialog();
		this.clearLogDialog = new ClearLogsDialog({parent: this});
	},
	show: function()
	{
		//Call Super
		SettingsPage.prototype.show.apply(this);

		if (!this.settings) {
			$.getJSON(API_BASEURL + 'settings/software/advanced', null, _.bind(function(data) {
				this.settings = data;
				this.render();
			}, this))
			.fail(function() {
				noty({text: "There was an error getting software advanced settings.", timeout: 3000});
			});
		}
	},
	render: function()
	{
		this.$el.html(this.template({ 
			data: this.settings,
			size_format: app.utils.sizeFormat
		}));		
	},
	serialLogChanged: function(e)
	{
		var target = $(e.currentTarget);
		var active = target.is(':checked');

		$.ajax({
			url: '/api/settings/software/logs/serial',
			method: 'PUT',
			data: JSON.stringify({
				'active': active
			}),
			contentType: 'application/json',
			dataType: 'json'
		})
		.done(function(){
			if (active) {
				$('#app').addClass('serial-log');
			} else {
				$('#app').removeClass('serial-log');
			}
		})
		.fail(function(){
			noty({text: "There was an error changing serial logs.", timeout: 3000});
		});
	}
});

var SendLogDialog = Backbone.View.extend({
	el: '#send-logs-modal',
	events: {
		'click button.secondary': 'doClose',
		'click button.success': 'doSend',
		'open.fndtn.reveal': 'onOpen'
	},
	onOpen: function()
	{
		this.$('input[name=ticket]').val('');
		this.$('textarea[name=message]').val('');
	},
	doClose: function()
	{
		this.$el.foundation('reveal', 'close');
		this.$('input[name=ticket]').val('');
		this.$('textarea[name=message]').val('');
	},
	doSend: function()
	{
		var button = this.$('.loading-button');

		var data = {
			ticket: this.$('input[name=ticket]').val(),
			message: this.$('textarea[name=message]').val()
		};

		button.addClass('loading');

		$.post(API_BASEURL + 'settings/software/logs', data)
			.done(_.bind(function(){
				noty({text: "Logs sent to AstroPrint!", type: 'success', timeout: 3000});
				this.$el.foundation('reveal', 'close');
				this.$('input[name=ticket]').val('');
				this.$('textarea[name=message]').val('');
			},this))
			.fail(function(){
				noty({text: "There was a problem sending your logs.", timeout: 3000});
			})
			.always(function(){
				button.removeClass('loading');
			});
	}	
});

var ClearLogsDialog = Backbone.View.extend({
	el: '#delete-logs-modal',
	events: {
		'click button.secondary': 'doClose',
		'click button.alert': 'doDelete',
		'open.fndtn.reveal': 'onOpen'		
	},
	parent: null,
	initialize: function(options)
	{
		this.parent = options.parent;
	},
	doClose: function()
	{
		this.$el.foundation('reveal', 'close');
	},
	doDelete: function()
	{
		this.$('.loading-button').addClass('loading');
		$.ajax({
			url: API_BASEURL + 'settings/software/logs', 
			type: 'DELETE',
			contentType: 'application/json',
			dataType: 'json',
			data: JSON.stringify({}),
			success: _.bind(function() {
				this.parent.$('.size').text('0 kB');
				this.doClose()
			}, this),
			error: function(){
				noty({text: "There was a problem clearing your logs.", timeout: 3000});
			},
			complete: _.bind(function() {
				this.$('.loading-button').removeClass('loading');
			}, this)
		})
	}
});

var ResetConfirmDialog = Backbone.View.extend({
	el: '#restore-confirm-modal',
	events: {
		'click button.secondary': 'doClose',
		'click button.alert': 'doReset',
		'open.fndtn.reveal': 'onOpen'
	},
	onOpen: function()
	{
		this.$('input').val('');
	},
	doClose: function()
	{
		this.$el.foundation('reveal', 'close');
	},
	doReset: function()
	{
		if (this.$('input').val() == 'RESET') {
			this.$('.loading-button').addClass('loading');
			$.ajax({
				url: API_BASEURL + 'settings/software/settings', 
				type: 'DELETE',
				contentType: 'application/json',
				dataType: 'json',
				data: JSON.stringify({}),
				success: function() {
					location.href = "";
				},
				complete: _.bind(function() {
					this.$('.loading-button').removeClass('loading');
				}, this)
			})
		} 
	}
});


/******************************************/

var SettingsMenu = Backbone.View.extend({
	el: '#settings-side-bar',
	subviews: null,
	initialize: function(params) {
		if (params.subviews) {
			this.subviews = params.subviews;
		}
	},
	changeActive: function(page) {
		var target = this.$el.find('li.'+page);
		this.$el.find('li.active').removeClass('active');
		target.closest('li').addClass('active');
		this.subviews[page].show();
	}
});

var SettingsView = Backbone.View.extend({
	el: '#settings-view',
	menu: null,
	subviews: null,
	initialize: function() {
		this.subviews = {
			'printer-connection': new PrinterConnectionView({parent: this}),
			'printer-profile': new PrinterProfileView({parent: this}),
			'internet-connection': new InternetConnectionView({parent: this}),
			'software-update': new SoftwareUpdateView({parent: this}),
			'software-advanced': new SoftwareAdvancedView({parent: this})
		};
		this.menu = new SettingsMenu({subviews: this.subviews});
	},
	onShow: function() {
		this.subviews['printer-connection'].show();
	}
});
