var net = require('net');

module.exports = function(RED) {
    function DashboardServer(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        var client = null;
        var retrying = false; // Ensures retries happen only once during the timeout period
        var reconnectTimeout = parseInt(config.timeout, 10) * 1000 || 5000; // Default to 5 seconds

        // Function to create and connect the client
        function createClient() {
            if (client) {
                client.end();  // Gracefully close the previous connection
            }

            client = new net.Socket();
            node.status({ fill: "yellow", shape: "ring", text: "connecting" });
            client.connect(parseInt(config.port), config.host, function() {
                // Create and send a message to the debug window
                var debugMsg = { payload: node.name + '\nconnected to host: ' + config.host + ':' + config.port };
                node.send(debugMsg);  // This sends the message to the debug window
                node.status({ fill: "green", shape: "dot", text: "connected" });
            });

            client.on('data', function(data) {
                data = data.toString().replace('\n', '');
                var result = {
                    "payload": data,
                    "topic": node.context()['last-ur-command'] || '',
                    "timestamp": new Date().valueOf()
                };
                node.send(result); // This sends the data to the output
            });

            client.on('close', function(reason) {
                // Create and send a message to the debug window
                var debugMsg = { payload: node.name + '\ndisconnected from host: ' + config.host + ':' + config.port };
                node.send(debugMsg);  // This sends the message to the debug window
                node.status({ fill: "red", shape: "ring", text: "disconnected" });

                // Only attempt to reconnect if not already retrying
                if (!retrying) {
                    retrying = true;
                    // Create and send a message to the debug window
                    var retryMsg = { payload: node.name + '\nAttempting to reconnect in ' + reconnectTimeout / 1000 + ' seconds...' };
                    node.send(retryMsg);  // This sends the message to the debug window
                    
                    // Delay reconnection with setTimeout
                    setTimeout(function() {
                        retrying = false; // Reset retrying flag
                        createClient(); // Try reconnecting after the timeout
                    }, reconnectTimeout);
                }
            });

            client.on('error', function(err) {
                // Create and send a message to the debug window
                var errorMsg = { payload: node.name + '\nError at tcp connection: ' + err.message };
                node.send(errorMsg);  // This sends the message to the debug window
                node.status({ fill: "red", shape: "ring", text: "error" });

                // Only attempt to reconnect if not already retrying
                if (!retrying) {
                    retrying = true;
                    // Create and send a message to the debug window
                    var retryMsg = { payload: node.name + '\nAttempting to reconnect in ' + reconnectTimeout / 1000 + ' seconds...' };
                    node.send(retryMsg);  // This sends the message to the debug window
                    
                    // Delay reconnection with setTimeout
                    setTimeout(function() {
                        retrying = false; // Reset retrying flag
                        createClient(); // Try reconnecting after the timeout
                    }, reconnectTimeout);
                }
            });
        }

        // Initial connection
        createClient();

        node.on('input', function(msg) {
            try {
                var arg = config.argument || '';
                var com = config.command || '';
                var command = com + ' ' + arg + '\n';
                if (config.usemsgtopic === true) {
                    command = msg.topic + '\n';
                }
                if (client && client.writable) {
                    client.write(command);
                }
                this.context()['last-ur-command'] = msg.topic || com + ' ' + arg;

                // Send debug message to the debug window with node name
                var debugMsg = { payload: node.name + '\nSending command: ' + command };
                node.send(debugMsg);  // This sends the message to the debug window
            } catch (error) {
                var errorMsg = { payload: node.name + '\nError at input: ' + error.message };
                node.send(errorMsg);  // This sends the message to the debug window
            }
        });
    }

    RED.nodes.registerType("dashboard-server", DashboardServer);
};
