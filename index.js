// App now uses a button instead of scanning automatically.
	// Run init function when the mobile device is ready
	// and alls scripts are loaded.
	document.addEventListener(
        'deviceready',
		function() {
            if (window.hyper && window.hyper.log) { console.log = hyper.log }
            evothings.scriptsLoaded(startScan) },
		false)

	// The closest device found.
    $.support.cors = true;
	var deviceWithStrongestRSSI = null
    var device_ID = "0";
	function startScan()
	{
        $('rescan').removeClass("success-btn").addClass("fail-btn");
        
        var value = window.localStorage.getItem("loggedIn");
        var v = (value==JSON.stringify("correct"));
		console.log('Scanning for device...')
        device_ID = device.uuid;
        // Reset found device variable.
		deviceWithStrongestRSSI = null

		// Specify that devices are reported repeatedly so that
		// we get the most recent RSSI reading for each device.
		evothings.easyble.reportDeviceOnce(false)

		// Start scanning.
        if(v){
            $('rescan').removeClass("fail-btn").addClass("success-btn");
            evothings.easyble.startScan(deviceDetected, scanError);
        }else{
            $('rescan').removeClass("success-btn").addClass("fail-btn");
            $.mobile.changePage($("#settings-pre"));
        }

		// Connect to the closest device after this timeout.
		setTimeout(connectToFoundDevice, 3000)
	}

	function stopScan()
	{
		console.log('Stop scanning')
        $('rescan').removeClass("success-btn").addClass("fail-btn");
		evothings.easyble.stopScan()
	}

	function deviceDetected(device)
	{
		console.log('Device found: ' + device.name + ' rssi: ' + device.rssi)
		// THIS IS WHERE YOU SPECIFY THE NAME OF THE
		// BLE DEVICE TO CONNECT TO.
		var myDeviceName = 'ViiiivaB261'

		// Check that advertised name matches the devices we are looking for.
		if (device.name == myDeviceName)
		{
			if (!deviceWithStrongestRSSI)
			{
				// First found device.
				deviceWithStrongestRSSI = device
			}
			else
			{
				// Update if next found device has stronger RSSI.
				if (device.rssi > deviceWithStrongestRSSI.rssi)
				{
					deviceWithStrongestRSSI = device
				}
			}
		}
	}

	function connectToFoundDevice()
	{
		if (!deviceWithStrongestRSSI)
		{
            $('rescan').removeClass("success-btn").addClass("fail-btn");
			console.log('No device found')
			return
		}
		stopScan();
		deviceWithStrongestRSSI.connect(deviceConnected, connectError);
	}

	function deviceConnected(device)
	{
		console.log('Connected to device: ' + device.name)
		console.log('Reading services... (this may take some time)')
		device.readServices(
			null,
			doneReadingServices,
			readServicesError)
	}

	function scanError(errorCode)
	{
		console.log('Scan failed:  '+ errorCode)
        $('rescan').removeClass("success-btn").addClass("fail-btn");
	}

	function connectError(errorCode)
	{
		console.log('Connect failed:  '+ errorCode);
        $('rescan').removeClass("success-btn").addClass("fail-btn");
	}

	function readServicesError(errorCode)
	{
		console.log('Read services failed:  '+ errorCode)
        $('rescan').removeClass("success-btn").addClass("fail-btn");
	}

	// Function that gets called when reading device.readServices()
	// has successfully completed.
	function doneReadingServices(device)
	{
		// Print to Tools window in Evothings Workbench.
        var service = device.__services[6];
        var characteristic = service.__characteristics[0];
        var descriptor = characteristic.__descriptors[0];
        var rate;
        console.log('  services: ' + service.uuid);
        console.log('    characteristic: ' + characteristic.uuid);
        console.log('      descriptor: ' + descriptor.uuid);
        device.enableNotification(
            characteristic.uuid,
            function(data){
                var dataArray = new Uint8Array(data);
                rate = dataArray[1];
                $('#rate').html('Heartrate: '+rate);
            },
            function(errorCode){
                console.log("fail: "+errorCode);
            }
        );
        function myLoop () {
           setTimeout(function () {
               $('#rate').html('Heartrate: '+rate);
               var dataset = null; 
               $.ajax({
                  url: "https://seanmolenaar.eu/team8/Application/rest.php?bpm="+rate+"&UUID="+device_ID,
                  context: document.body
                }).done(function(data) {
                   dataset = JSON.parse(data);
                   if(dataset.status=="Heartrate recorded successfully!"){
                       myLoop();
                   }else{
                       console.error("submission failed");
                       
                       // Done disconnecting from device.
                       console.log('Done disconnecting from device');
                       $('rescan').removeClass("success-btn").addClass("fail-btn");
                       // Disconnect from device.
                       device.close();
                   };
                }).fail(function(data){
                   console.log(data.statusText);
                    // Done disconnecting from device.
                    console.log('Done disconnecting from device');
                    $('rescan').removeClass("success-btn").addClass("fail-btn");
                   // Disconnect from device.
                   device.close();
               });               
           }, 5000)
        }
        myLoop();                      //  start the loop
        device.writeDescriptor(
            characteristic.uuid,
            descriptor.uuid,
            new Uint8Array([1,0]),
            function(data){
                console.log('Data: '+JSON.stringify(data));
            },
            function(errorCode){
                console.log('Error reading: '+JSON.stringify(errorCode));
                $('rescan').removeClass("success-btn").addClass("fail-btn");
            }
        );
	} 
    $( document ).bind( "pagebeforechange ", function( event, data ){
        var p = (data.absUrl==="file:///android_asset/www/index.html#settings-pre");
        var v = (window.localStorage.getItem("loggedIn")==JSON.stringify("correct"));
        if(p&&v){
            event.preventDefault();
            $.mobile.changePage($("#settings-past"));
        }
    });


    $( "#settings-past a.logout" ).on("tap click", function( event ) {
        window.localStorage.removeItem("loggedIn");
        $('rescan').removeClass("success-btn").addClass("fail-btn");
        $("#settings-pre div.result").removeClass("fail success").text(" ");
        $.mobile.changePage($("#settings-pre"));
    });
    
    $( "#home a.rescan" ).on("tap click", function( event ) {
        event.preventDefault();
        startScan();
    });

    $( "#target a.submit" ).on("tap click", function( event ) {
        event.preventDefault();
        $.mobile.loading( 'show', {
          text: "Asking our rabbit if it knows you",
          textVisible: true,
          theme: "b",
          textonly: false,
          html: ""
        });
        console.log("Starting login.");
        $.ajax({
            url: "https://seanmolenaar.eu/team8/Application/rest.php",
            method:'POST',
            data: { email: $("#mail").val(), pass: $("#pass").val(), UUID: device_ID},
            context: document.body,
            dataType: "json"
        }).done(function(data) {
            if(data.status=="login"){
                console.log("Login succeeded!");
                window.localStorage.setItem("loggedIn", JSON.stringify("correct"));
                $("#target div.result").addClass("success").text("You are now logged in.");
                $.mobile.changePage($("#settings-past"));
            }else{
                console.log("Login Failed!");
                $("#target div.result").addClass("fail").text("Error: Username and/or password invalid.");
            }
        }).fail(function(data){
            console.log(data.statusText);
            console.log("Connection failed!");
            $("#settings-pre div.result").addClass("fail").text("Unfortunately, we couldn't get you logged in. Are you sure your account exists?");
        }).complete(function(){
            $.mobile.loading( 'hide' );
        }); 
    });