	// Run init function when the mobile device is ready
	// and alls scripts are loaded.
	document.addEventListener(
	    'deviceready',
	    function() {
	        if (window.hyper && window.hyper.log) {
	            console.log = hyper.log
	        }
	        evothings.scriptsLoaded(startScan);
	        cordova.plugins.backgroundMode.setDefaults({
	            Title: 'Monitoring heartrate.'
	        });
	        $.support.cors = true;
	    },
	    false);

	// The closest device found.
	var deviceWithStrongestRSSI = null
	    //empty variable for browser debugging
	var device_ID = "0";
    var rate;

	/**
	 * First function to be run. Checks previous login and redirects if need be.
	 */
	function startScan() {
	    $('rescan').removeClass("success-btn").addClass("fail-btn");

	    var value = window.localStorage.getItem("loggedIn");
	    var v = (value == JSON.stringify("correct"));
	    console.log('Scanning for device...')
	    device_ID = device.uuid;
	    // Reset found device variable.
	    deviceWithStrongestRSSI = null

	    // Specify that devices are reported repeatedly so that
	    // we get the most recent RSSI reading for each device.
	    evothings.easyble.reportDeviceOnce(false)

	    // Start scanning.
	    if (v) {
	        $('rescan').removeClass("fail-btn").addClass("success-btn");
	        evothings.easyble.startScan(deviceDetected, scanError);
	        setTimeout(connectToFoundDevice, 3000);
	    } else {
	        $('rescan').removeClass("success-btn").addClass("fail-btn");
	        $.mobile.changePage($("#settings-pre"));
	    }
	}

	/**
	 * Stops scan if needed
	 */
	function stopScan() {
	    console.log('Stop scanning')
	    $('rescan').removeClass("success-btn").addClass("fail-btn");
	    evothings.easyble.stopScan()
	}

	/**
	 * Success return on the device scan. Checks if it's the nearest device with this name.
	 * @param {Object} device The bluetooth device that was detected as being closest
	 */
	function deviceDetected(device) {
	    console.log('Device found: ' + device.name + ' rssi: ' + device.rssi)
	        // THIS IS WHERE YOU SPECIFY THE NAME OF THE
	        // BLE DEVICE TO CONNECT TO.
	    var myDeviceName = 'ViiiivaB261'

	    // Check that advertised name matches the devices we are looking for.
	    if (device.name == myDeviceName) {
	        if (!deviceWithStrongestRSSI) {
	            // First found device.
	            deviceWithStrongestRSSI = device
	        } else {
	            // Update if next found device has stronger RSSI.
	            if (device.rssi > deviceWithStrongestRSSI.rssi) {
	                deviceWithStrongestRSSI = device
	            }
	        }
	    }
	}

	/**
	 * Connect to chosen device after 3 seconds of checking.
	 */
	function connectToFoundDevice() {
	    if (!deviceWithStrongestRSSI) {
	        $('rescan').removeClass("success-btn").addClass("fail-btn");
	        console.log('No device found')
	        return
	    }
	    stopScan();
	    deviceWithStrongestRSSI.connect(deviceConnected, connectError);
	}

	/**
	 * Success: connectToFoundDevice(); Start reading services of the connected device.
	 * @param {Object} device The device it's supposed to connect to
	 */
	function deviceConnected(device) {
	    console.log('Connected to device: ' + device.name)
	    console.log('Reading services... (this may take some time)')
	    device.readServices(
	        null,
	        doneReadingServices,
	        readServicesError)
	}

	/**
	 * Failure: startScan(); The scan failed to complete.
	 * @param {String} errorCode The error that was encountered
	 */
	function scanError(errorCode) {
	    console.log('Scan failed:  ' + errorCode)
	    $('rescan').removeClass("success-btn").addClass("fail-btn");
	}

	/**
	 * Failure: connectToFoundDevice(); The device that we found could not be connected to.
	 * @param {String} errorCode The error that was encountered
	 */
	function connectError(errorCode) {
	    console.log('Connect failed:  ' + errorCode);
	    $('rescan').removeClass("success-btn").addClass("fail-btn");
	}

	/**
	 * Failure: deviceConnected(); The device was connected but we couldn't read the services
	 * @param {String} errorCode The error that was encountered
	 */
	function readServicesError(errorCode) {
	    console.log('Read services failed:  ' + errorCode)
	    $('rescan').removeClass("success-btn").addClass("fail-btn");
	}

	/**
	 * Success: deviceConnected(); The device was connected and we read the services. Now we'll read their children and start a notification service.
	 * @param {Object} device The device we're going to use
	 */
	function doneReadingServices(device) {
	    // Print the hierarcy stack for the descriptor.
	    var service = device.__services[6];
	    var characteristic = service.__characteristics[0];
	    var descriptor = characteristic.__descriptors[0];
	    
	    console.log('  services: ' + service.uuid);
	    console.log('    characteristic: ' + characteristic.uuid);
	    console.log('      descriptor: ' + descriptor.uuid);

	    //Start a notification service that'll update 'rate' on every notification.
	    device.enableNotification(
	        characteristic.uuid,
	        function(data) {
	            var dataArray = new Uint8Array(data);
	            rate = dataArray[1];
	            $('#rate').html('Heartrate: ' + rate);
	        },
	        function(errorCode) {
	            console.log("fail: " + errorCode);
	        }
	    );

	    //This is just needed to activate the notifications. IDK
	    device.writeDescriptor(
	        characteristic.uuid,
	        descriptor.uuid,
	        new Uint8Array([1, 0]),
	        function(data) {
	            console.log('Data: ' + JSON.stringify(data));
	        },
	        function(errorCode) {
	            console.log('Error reading: ' + JSON.stringify(errorCode));
	            $('rescan').removeClass("success-btn").addClass("fail-btn");
	        }
	    );
	    myLoop();
	}

	/**
	 * Send the rate to the server. We do this every 5s until it fails.
	 */
	function myLoop() {
	    setTimeout(function() {
	        if (!cordova.plugins.backgroundMode.isEnabled()) {
                cordova.plugins.backgroundMode.enable();
            }
            cordova.plugins.backgroundMode.configure({
                title: "Heartbeat is monitored",
                text: "Heartrate: " + rate + "bpm"
            });
	        var dataset = null;
	        $.ajax({
	            url: "https://seanmolenaar.eu/team8/Application/rest.php?bpm=" + rate + "&UUID=" + device_ID,
	            context: document.body
	        }).done(function(data) {
	            dataset = JSON.parse(data);
	            if (dataset.status == "Heartrate recorded successfully!") {
	                myLoop();
	            } else {
	                console.error("submission failed");
	                // Done disconnecting from device.
	                console.log('Done disconnecting from device');
	                $('rescan').removeClass("success-btn").addClass("fail-btn");
	                // Disconnect from device.
	                device.close();
	            };
	        }).fail(function(data) {
	            console.log(data.statusText);
	            // Done disconnecting from device.
	            console.log('Done disconnecting from device');
	            $('rescan').removeClass("success-btn").addClass("fail-btn");
	            // Disconnect from device.
	            device.close();
	        });
	    }, 5000)
	}

	/**
	 * Redirect people to the proper settings page, depending on their loggedIn status.
	 */
	$(document).bind("pagebeforechange ", function(event, data) {
	    var p = (data.absUrl === "file:///android_asset/www/index.html#settings-pre");
	    var v = (window.localStorage.getItem("loggedIn") == JSON.stringify("correct"));
	    if (p && v) {
	        event.preventDefault();
	        $.mobile.changePage($("#settings-past"));
	    }
	});

	/**
	 * Log people out.
     2*/
	$("#settings-past a.logout").on("tap click", function(event) {
        $.ajax({
	        url: "https://seanmolenaar.eu/team8/Application/rest.php",
	        method: 'POST',
	        data: {
	            first_active: window.localStorage.getItem("first_active"),
	            UUID: device_ID
	        },
	        context: document.body,
	        dataType: "json"
	    }).complete(function() {
            window.localStorage.removeItem("loggedIn");
            window.localStorage.removeItem("first_active");
            $('rescan').removeClass("success-btn").addClass("fail-btn");
	       $("#settings-pre div.result").removeClass("fail success").text(" ");
	       $.mobile.changePage($("#settings-pre"));
            if (!cordova.plugins.backgroundMode.isEnabled()) {
                cordova.plugins.backgroundMode.disable();
            }
	    });
	});

	/**
	 * Start scan in case that wasn't done yet.
	 */
	$("#home a.rescan").on("tap click", function(event) {
	    event.preventDefault();
	    startScan();
	});

	/**
	 * Log in to the service.
	 */
	$("#target a.submit").on("tap click", function(event) {
	    event.preventDefault();
	    $.mobile.loading('show', {
	        text: "Asking our rabbit if it knows you",
	        textVisible: true,
	        theme: "b",
	        textonly: false,
	        html: ""
	    });
	    console.log("Starting login.");
	    $.ajax({
	        url: "https://seanmolenaar.eu/team8/Application/rest.php",
	        method: 'POST',
	        data: {
	            email: $("#mail").val(),
	            pass: $("#pass").val(),
	            UUID: device_ID
	        },
	        context: document.body,
	    }).done(function(data) {
            var dataset = JSON.parse(data);
            console.log(JSON.stringify(dataset));
	        if (dataset.status == "login") {
	            console.log("Login succeeded!");
	            window.localStorage.setItem("loggedIn", JSON.stringify("correct"));
                window.localStorage.setItem("first_active", dataset.date);
	            $("#target div.result").addClass("success").text("You are now logged in.");
	            $.mobile.changePage($("#home"));
                startScan();
	        } else {
	            console.log("Login Failed!");
	            $("#target div.result").addClass("fail").text("Error: " + dataset.desc);
	        }
	    }).fail(function(data) {
	        console.log(data.statusText);
	        console.log("Connection failed!");
	        $("#settings-pre div.result").addClass("fail").text("Unfortunately, we couldn't get you logged in. Are you sure your account exists?");
	    }).complete(function() {
	        $.mobile.loading('hide');
	    });
	});