const abiDecoder = require('abi-decoder')

function EventsHelper() {
    var allEventsWatcher = undefined;

    var waitReceipt = function(transactionHash, address) {
        return new Promise(function(resolve, reject) {
            var transactionCheck = function() {
                var receipt = transactionHash.receipt;
                if (receipt) {
                    var count = 0;
                    if (address) {
                        receipt.logs.forEach(function(log) {
                            count += log.address === address ? 1 : 0;
                        });
                    } else {
                        count = receipt.logs.length;
                    }
                    return resolve(count);
                }
            };
            transactionCheck();
        });
    };

    var waitEvents = function(watcher, count) {
        return new Promise(function(resolve, reject) {
            var transactionCheck = function() {
                watcher.get(function(err, events) {
                    if (err) {
                        console.log(err);
                        return reject(err);
                    }
                    if (events) {
                        if (events.length == count) {
                            return resolve(events);
                        }
                        if (events.length > count) {
                            console.log(events);
                            return reject("Filter produced " + events.length + " events, while receipt produced only " + count + " logs.");
                        }
                    }
                    setTimeout(transactionCheck, 100);
                });
            };
            transactionCheck();
        });
    };

    this.getEvents = function(transactionHash, watcher) {
        if (allEventsWatcher === undefined) {
            throw "Call setupEvents before target transaction send."
        }
        return new Promise(function(resolve, reject) {
            waitReceipt(transactionHash, watcher.options.address).then(function(logsCount) {
                return waitEvents(allEventsWatcher, logsCount);
            }).then(function() {
                watcher.get(function(err, events) {
                    if (err) {
                        console.log(err);
                        return reject(err);
                    }
                    return resolve(events);
                });
            });
        });
    };

    this.setupEvents = function(contract) {
        allEventsWatcher = contract.allEvents();
    }

    this.extractEvents = function(txHash, eventName) {
        if (txHash.logs.length == 0) {
            return [];
        }

        const logs = txHash.logs;
        var filteredLogs = [];
        for (var logEntry of logs) {
            if (logEntry.event.toLowerCase() == eventName.toLowerCase()) {
                filteredLogs.push(logEntry);
            }
        }
        return filteredLogs
    }

    this.extractReceiptLogs = (tx, eventWatcher) => {
        return new Promise((resolve, reject) => {
            let receipt = tx.receipt
            if (receipt.logs.length == 0) {
                resolve([])
                return
            }

            var logs = []
            for (logEntry of receipt.logs) {
                if (logEntry.topics[0].toLowerCase() === eventWatcher.options.topics[0].toLowerCase()) {
                    logs.push(logEntry)
                }
            }
            resolve(logs)
        })
    }

    // Decode and find events from receipt generated by `contracts`
    this.findEvent = async (contracts, tx, eventName) => {
        contracts.forEach(c => abiDecoder.addABI(c.abi))

        let logs = abiDecoder.decodeLogs(tx.receipt.logs)
        let events = logs.filter(l => l !== undefined)
                         .filter(l => l !== null)
                         .filter(l => l.name === eventName)
                         .map(l => _updateWithArgs(l))

        contracts.forEach(c => abiDecoder.removeABI(c.abi))
        return events
    }

    function _updateWithArgs(event) {
        var args = {}
        for (arg of event.events) {
            args[arg.name] = arg.value
        }

        event["args"] = args
        return event
    }
};

module.exports = new EventsHelper();
