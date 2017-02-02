var cfenv = require("cfenv");
var request = require("request");
var appEnv = cfenv.getAppEnv();

var serviceDiscoveryToken = "";
var serviceDiscoveryURL = "";

var serviceDiscoveryCreds = appEnv.getService("myMicroservicesServiceDiscovery");
serviceDiscoveryToken = serviceDiscoveryCreds.credentials.auth_token;
serviceDiscoveryURL = serviceDiscoveryCreds.credentials.url;

// Register this application with Service Discovery.
exports.register = function(){
	console.log("called register");
	var requestOptions = {
		url: serviceDiscoveryURL + "/api/v1/instances",
		method: "POST",
		headers: {
			"Authorization": "bearer " + serviceDiscoveryToken
		},
		json: {
			"service_name": "Catalog-API",
			"endpoint": {
				"type": "tcp",
				"value": JSON.parse(process.env.VCAP_APPLICATION)['application_uris'][0]
			},
			"ttl": 300,
			"status": "UP"
		}
	};

	request(requestOptions, function (err, res, body) {
		if (err) {
			console.log("Error registering with service discovery. " + JSON.stringify(err));
		}
		else{
			console.log("Successfully registered with service discovery.");
			setHeartbeat(body.links.heartbeat, body.ttl);
		}
	});
}

// Service Discovery requires you to send a PUT request to a heartbeat url every so often so the discovery service
// knows this application is still healthy. We will send a heartbeat when we are halfway through the ttl (time to live).
function setHeartbeat(heartbeatURL, ttl){
	var heartBeatInterval = setInterval(function () {
		var heartbeatOptions = {
			url:heartbeatURL, 
			method: "PUT",
			headers: {
				"Authorization": "bearer " + serviceDiscoveryToken
			}
		}
		request(heartbeatOptions, function (err, response, body) {
			if(response.statusCode == 410){
				console.log("Catalog application was no longer registered with service discovery. Reregistering application...");
				clearInterval(heartBeatInterval);
				exports.register();
			}
			else if (err || response.statusCode != 200) {
				console.log("Heartbeat request failed. " + response.body);
			}
		});
	}, (ttl * 1000) * .50);
}
