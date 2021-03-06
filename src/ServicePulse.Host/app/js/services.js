'use strict';

/* Services */

// Demonstrate how to register services
// In this case it is a simple value service.
angular.module('sc.services', ['angular-cache'])
    .constant('serviceControlUrl', 'http://localhost:33333/api')
    .run(function ($http, $angularCacheFactory) {
        $angularCacheFactory('defaultCache', {
            capacity: 1000,  // This cache can hold 1000 items,
            maxAge: 90000, // Items added to this cache expire after 15 minutes
            aggressiveDelete: true, // Items will be actively deleted when they expire
            cacheFlushInterval: 3600000, // This cache will clear itself every hour,
            storageMode: 'localStorage'
        });

        //$http.defaults.cache = $angularCacheFactory.get('defaultCache');
    })
    .factory('streamService', ['$log', '$rootScope', 'serviceControlUrl', function($log, $rootScope, serviceControlUrl) {
        var prefix = 'signalr::';
        var connection = $.connection(serviceControlUrl + '/messagestream');
        var registrations = {};
        
        connection.received(function(data) {
            $log.info('SignalR data received');
            $log.info(data);
            $rootScope.$broadcast(prefix + data.type, data.message);
        });

        connection.start().done(function() {
            $log.info('SignalR started');
        });

        var onSubscribe = function($scope, messageType, handler) {
            var deregFunc = $scope.$on(prefix + messageType, function (event, message) {
                $scope.$apply(function(_) {
                    handler(message);
                });
            });

            registrations[messageType + $scope.$id] = deregFunc;
        };

        var onUnsubscribe = function($scope, messageType) {
            var deregFunc = registrations[messageType + $scope.$id];

            if (deregFunc !== null) {
                deregFunc();
            }
            
            delete registrations[messageType + $scope.$id];
        };

        return {
            subscribe: onSubscribe,
            unsubscribe: onUnsubscribe,
            send: function(messageType, message) {
                connection.send(JSON.stringify({ message: message, type: messageType }));
            }
        };
    }])
    .service('serviceControlService', ['$http', 'serviceControlUrl', function($http, serviceControlUrl) {

        this.getAlerts = function () {
            return $http.jsonp(serviceControlUrl + '/alerts?callback=JSON_CALLBACK').then(function (response) {
                return response.data;
            });
        };
        
        this.getHeartbeatStats = function () {
            return $http.jsonp(serviceControlUrl + '/heartbeats/stats?callback=JSON_CALLBACK').then(function (response) {
                return response.data;
            });
        };
        
        this.getHeartbeatsList = function () {
            return $http.jsonp(serviceControlUrl + '/heartbeats?callback=JSON_CALLBACK').then(function (response) {
                return response.data;
            });
        };
        
        this.getEndpoints = function() {
            return $http.jsonp(serviceControlUrl + '/endpoints?callback=JSON_CALLBACK').then(function(response) {
                return response.data;
            });
        };

        this.getEndpointsWithSla = function() {
            return this
                .getEndpoints()
                .then(function(endpoints) {
                    var results = [];
                    endpoints.forEach(function(item) {
                        $http.jsonp(serviceControlUrl + '/endpoints/' + item.name + '/sla?callback=JSON_CALLBACK').then(function (response) {
                            angular.extend(item, {sla: response.data.current});
                            results.push(item);
                        });
                    });

                    return results;
                });
        };

    }]);
