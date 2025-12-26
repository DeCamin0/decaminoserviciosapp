import { useState, useEffect, useCallback } from 'react';

const ServerMonitor = ({ netdataCloudConfig }) => {
  const [serverStatus, setServerStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [serverData, setServerData] = useState({});

  const [lastUpdate, setLastUpdate] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Configurația pentru Netdata Cloud - actualizată
  const defaultCloudConfig = {
    cloudUrl: 'https://app.netdata.cloud',
    apiKey: 'ndc.LFBOzvx7Fj2y4RcIG1Olt98tjUsreqz5RpVgWepyGCJSE9wMTFVB54j3NwxhWoHeyYAUECIdCCEYALJEMWegg6OHbuhkBMccEpLaUSxcE9ovAUVrG6Zm39nQEoUmon0t',
    spaces: [
      {
        id: '5f8c0359-8509-4867-858d-a217b5c9f727',
        name: 'Decamino rrhh space',
        servers: [
          { id: '7764789d-63d5-49fb-a0e4-dfeae97b5f74', name: 'VPS 1 - DeCamino' },
          { id: 'cdc0c2d9-7d9b-4b72-aa47-4b201446d045', name: 'VPS 2 - Backup' }
        ]
      }
    ]
  };

  const config = netdataCloudConfig || defaultCloudConfig;

  // Funcția pentru testarea conectivității la Netdata Cloud
  const testNetdataConnectivity = useCallback(async () => {
    try {
      // Testează direct primul server pentru a verifica conectivitatea
      const testServerId = config.spaces[0]?.servers[0]?.id;
      if (!testServerId) {
        return { success: false, error: 'Nu sunt servere configurate' };
      }

      console.log('🔍 Testing connectivity with server:', testServerId);
      
      const response = await fetch(`${config.cloudUrl}/api/v1/nodes/${testServerId}/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('🔍 Connectivity test response:', response.status);

      if (response.ok) {
        console.log('✅ Connectivity test successful');
        return { success: true };
      } else {
        console.log('❌ Connectivity test failed:', response.status);
        return { success: false, error: `Conectivitate eșuată: ${response.status}` };
      }
    } catch (error) {
      console.error('❌ Connectivity test error:', error);
      return { success: false, error: `Eroare de rețea: ${error.message}` };
    }
  }, [config.apiKey, config.cloudUrl, config.spaces]);

  // Funcția pentru extragerea datelor reale din API - îmbunătățită
  const extractRealData = useCallback((responseData) => {
    const data = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 'N/A',
      uptime: 0,
      alerts: 0,
      metrics: 0,
      // Detalii suplimentare
      os: '',
      kernel: '',
      architecture: '',
      virtualization: '',
      cpuFreq: '',
      version: '',
      hostname: '',
      cloudProvider: '',
      instanceType: '',
      region: ''
    };
    
    try {
      console.log('🔍 Analyzing API response structure:', responseData);
      
      // Extrag datele în funcție de structura răspunsului
      if (responseData.version) { // Endpoint /info
        console.log('📋 Processing /info endpoint data');
        
        // Informații de bază
        data.version = responseData.version;
        console.log('📦 Version:', data.version);
        
        // CPU cores
        if (responseData['cores_total']) {
          data.cpu = responseData['cores_total'];
          console.log('🖥️ CPU cores:', data.cpu);
        }
        
        // CPU frequency
        if (responseData['cpu_freq']) {
          data.cpuFreq = `${Math.round(responseData['cpu_freq'] / 1000000)} MHz`;
          console.log('⚡ CPU frequency:', data.cpuFreq);
        }
        
        // RAM total
        if (responseData['ram_total']) {
          const ramGB = Math.round(responseData['ram_total'] / (1024 * 1024 * 1024));
          data.memory = ramGB;
          console.log('💾 Total RAM:', data.memory, 'GB');
        }
        
        // Disk space
        if (responseData['total_disk_space']) {
          const diskGB = Math.round(responseData['total_disk_space'] / (1024 * 1024 * 1024));
          data.disk = diskGB;
          console.log('💿 Total disk space:', data.disk, 'GB');
        }
        
        // Metrics count
        if (responseData['metrics-count']) {
          data.metrics = responseData['metrics-count'];
          console.log('📊 Metrics count:', data.metrics);
        }
        
        // Charts count
        if (responseData['charts-count']) {
          console.log('📈 Charts count:', responseData['charts-count']);
        }
        
        // Alerts - suma din warning + critical
        if (responseData.alarms) {
          data.alerts = (responseData.alarms.warning || 0) + (responseData.alarms.critical || 0);
          console.log('🚨 Alerts:', data.alerts, '(warning:', responseData.alarms.warning, 'critical:', responseData.alarms.critical, ')');
        }
        
        // Uptime - dacă este disponibil
        if (responseData.uptime) {
          data.uptime = Math.floor(responseData.uptime / (24 * 60 * 60)); // Convert to days
          console.log('⏰ Uptime days:', data.uptime);
        }
        
        // Network info - dacă este disponibil
        if (responseData.network) {
          data.network = responseData.network;
        }
        
        // Informații despre sistem
        if (responseData['os_name']) {
          data.os = `${responseData['os_name']} ${responseData['os_version'] || ''}`.trim();
          console.log('💻 OS:', data.os);
        }
        
        if (responseData['kernel_name']) {
          data.kernel = `${responseData['kernel_name']} ${responseData['kernel_version'] || ''}`.trim();
          console.log('🐧 Kernel:', data.kernel);
        }
        
        if (responseData.architecture) {
          data.architecture = responseData.architecture;
          console.log('🏗️ Architecture:', data.architecture);
        }
        
        if (responseData.virtualization) {
          data.virtualization = responseData.virtualization;
          console.log('🖥️ Virtualization:', data.virtualization);
        }
        
        // Informații despre cloud
        if (responseData['cloud_provider_type']) {
          data.cloudProvider = responseData['cloud_provider_type'];
          console.log('☁️ Cloud provider:', data.cloudProvider);
        }
        
        if (responseData['cloud_instance_type']) {
          data.instanceType = responseData['cloud_instance_type'];
          console.log('🖥️ Instance type:', data.instanceType);
        }
        
        if (responseData['cloud_instance_region']) {
          data.region = responseData['cloud_instance_region'];
          console.log('🌍 Region:', data.region);
        }
        
        // Verifică status-ul serverului
        if (responseData['mirrored_hosts_status'] && responseData['mirrored_hosts_status'].length > 0) {
          const hostStatus = responseData['mirrored_hosts_status'][0];
          data.hostname = hostStatus.hostname;
          console.log('🏠 Host status:', hostStatus.hostname, '- Reachable:', hostStatus.reachable);
        }
        
        // Informații despre container
        if (responseData.container) {
          console.log('📦 Container:', responseData.container);
        }
        
        // Informații despre funcții
        if (responseData.functions) {
          console.log('🔧 Functions:', responseData.functions);
        }
        
        // Informații despre colectori
        if (responseData.collectors) {
          console.log('📡 Collectors:', responseData.collectors);
        }
        
      } else if (responseData.metrics) {
        // Pentru endpoint-uri cu metrics
        console.log('📊 Processing metrics endpoint data');
        data.metrics = Object.keys(responseData.metrics).length;
        
        if (responseData.alerts) {
          data.alerts = responseData.alerts.length || 0;
        }
      }
      
      console.log('✅ Successfully extracted real data:', data);
      return data;
      
    } catch (error) {
      console.error('❌ Error extracting real data:', error);
      return data;
    }
  }, []);

  // Funcția pentru obținerea datelor din Netdata Cloud - îmbunătățită
  const fetchNetdataData = useCallback(async () => {
    const status = {};
    const data = {};
    
    setIsUpdating(true);
    setApiError(null);
    console.log('🔍 Fetching data from Netdata Cloud...');
    console.log('🔍 API Key (first 20 chars):', config.apiKey.substring(0, 20));
    console.log('🔍 Cloud URL:', config.cloudUrl);
    
    try {
      // Testează mai întâi conectivitatea la Netdata Cloud
      const connectivityTest = await testNetdataConnectivity();
      if (!connectivityTest.success) {
        throw new Error(connectivityTest.error);
      }

      // Încercăm să obținem datele reale din Netdata Cloud
      for (const space of config.spaces) {
        for (const server of space.servers) {
          console.log(`📊 Fetching data for ${server.name}...`);
          
          // Endpoint-uri actualizate pentru Netdata Cloud v2
          const endpoints = [
            `/api/v1/nodes/${server.id}/info`  // Acesta funcționează perfect!
          ];
          
          let serverDataFound = false;
          
          for (const endpoint of endpoints) {
            try {
              const response = await fetch(`${config.cloudUrl}${endpoint}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${config.apiKey}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                }
              });
              
              console.log(`🔗 Trying ${endpoint}:`, response.status);
              
              if (response.ok) {
                const responseData = await response.json();
                console.log(`✅ Data received for ${server.name}:`, responseData);
                
                // Marchez serverul ca ONLINE dacă API-ul răspunde cu 200 OK
                status[server.id] = 'online';
                console.log(`🟢 Server ${server.name} marked as ONLINE`);
                
                // Extrag datele reale din răspunsul Netdata Cloud
                let processedData = extractRealData(responseData);
                data[server.id] = processedData;
                serverDataFound = true;
                console.log(`✅ Successfully processed data for ${server.name}`);
                break;
              } else if (response.status === 401) {
                console.log(`❌ Unauthorized for ${endpoint} - API key might be invalid`);
                setApiError('API key invalid sau expirat. Verifică configurația.');
              } else if (response.status === 404) {
                console.log(`❌ Endpoint ${endpoint} not found`);
              } else {
                console.log(`❌ Endpoint ${endpoint} returned ${response.status}`);
              }
            } catch (error) {
              console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
            }
          }
          
          // Dacă nu am găsit date prin API, marchez ca offline
          if (!serverDataFound) {
            console.log(`❌ No real data available for ${server.name}`);
            status[server.id] = 'offline';
            console.log(`🔴 Server ${server.name} marked as OFFLINE (no data available)`);
            
            // Adaug date default pentru a evita erorile de afișare
            data[server.id] = {
              cpu: 0,
              memory: 0,
              disk: 0,
              network: 'N/A',
              uptime: 0,
              alerts: 0,
              metrics: 0
            };
          }
        }
      }
      
      status.cloud = 'online';
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('💥 Error fetching Netdata Cloud data:', error);
      status.cloud = 'offline';
      setApiError(error.message);
    }
    
    setServerStatus(status);
    setServerData(data);
    setLoading(false);
    setIsUpdating(false);
  }, [config.apiKey, config.cloudUrl, config.spaces, testNetdataConnectivity, extractRealData]);

  // Obține datele din Netdata Cloud folosind API Key-ul
  useEffect(() => {
    // Prima încărcare
    fetchNetdataData();

    // Actualizare în timp real la fiecare 30 secunde
    const interval = setInterval(fetchNetdataData, 30000);

    return () => clearInterval(interval);
  }, [fetchNetdataData]);

  // Componenta pentru afișarea metricilor
  const MetricCard = ({ title, value, unit, color, icon }) => (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600">{title}</div>
          <div className="text-2xl font-bold text-gray-800">{value}{unit}</div>
        </div>
        <div className={`text-3xl ${color}`}>{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        <span className="ml-3 text-gray-600">Obțin date din Netdata Cloud...</span>
      </div>
    );
  }

  return (
    <div className="server-monitor">
      {/* Header cu status Cloud */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-700">
            Netdata Cloud Monitor
          </h3>
          <div className="flex items-center mt-2 space-x-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                serverStatus.cloud === 'online' 
                  ? 'bg-green-500' 
                  : 'bg-red-500'
              }`}></div>
              <span className={`text-sm font-medium ${
                serverStatus.cloud === 'online' 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {serverStatus.cloud === 'online' ? 'Cloud Online' : 'Cloud Offline'}
              </span>
            </div>
            
            {/* Indicator actualizare în timp real */}
            <div className="flex items-center">
              {isUpdating ? (
                <div className="flex items-center text-blue-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-xs">Actualizare...</span>
                </div>
              ) : (
                <div className="flex items-center text-gray-600">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-xs">
                    {lastUpdate ? `Ultima actualizare: ${lastUpdate.toLocaleTimeString()}` : 'Încărcare...'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Buton Refresh */}
          <button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              fetchNetdataData();
            }}
            disabled={isUpdating}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center ${
              isUpdating 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <span className={`mr-2 ${isUpdating ? 'animate-spin' : ''}`}>
              🔄
            </span>
            {isUpdating ? 'Actualizare...' : 'Refresh'}
          </button>
          
          {/* Buton Configurare */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {showConfig ? 'Ascunde Configurare' : 'Configurează Cloud'}
          </button>
        </div>
      </div>

      {/* Afișare eroare API */}
      {apiError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            <div>
              <h4 className="font-semibold text-red-800">Eroare API Netdata Cloud</h4>
              <p className="text-sm text-red-700 mt-1">{apiError}</p>
              <p className="text-xs text-red-600 mt-2">
                Verifică API key-ul și asigură-te că serverele sunt active în Netdata Cloud.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Panou de configurare */}
      {showConfig && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h4 className="font-semibold mb-3">Configurare Netdata Cloud:</h4>
          <div className="space-y-3">
            <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
              <p className="text-sm text-blue-800">
                <strong>API Key configurat:</strong> {config.apiKey.substring(0, 20)}...
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Space ID: {config.spaces[0].id}
              </p>
              <p className="text-xs text-blue-600">
                Servere configurate: {config.spaces[0].servers.length}
              </p>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-800">
                <strong>Notă:</strong> Dacă serverele apar ca offline, verifică:
              </p>
              <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside">
                <li>API key-ul este valid și nu a expirat</li>
                <li>Serverele sunt active în Netdata Cloud</li>
                <li>Endpoint-urile API sunt corecte</li>
              </ul>
            </div>
          </div>
        </div>
      )}

              {/* Inicio-uri cu date reale */}
      {serverStatus.cloud === 'online' ? (
        <div className="space-y-6">
          {config.spaces.map((space, spaceIndex) => (
            <div key={spaceIndex} className="bg-white rounded-lg shadow-lg border">
              <div className="p-4 border-b bg-gradient-to-r from-red-50 to-red-100">
                <h3 className="text-xl font-semibold text-gray-800">
                  {space.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Monitorizare în timp real a serverelor
                </p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {space.servers.map((server, serverIndex) => {
                    const data = serverData[server.id];
                    return (
                      <div key={serverIndex} className="bg-gray-50 rounded-lg p-6 border">
                        {/* Header server */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-800">
                              {server.name}
                            </h4>
                            <div className="flex items-center mt-1">
                              <div className={`w-2 h-2 rounded-full mr-2 ${
                                serverStatus[server.id] === 'online' 
                                  ? 'bg-green-500' 
                                  : 'bg-red-500'
                              }`}></div>
                              <span className={`text-xs ${
                                serverStatus[server.id] === 'online' 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                              }`}>
                                {serverStatus[server.id] === 'online' ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Metrici principale */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <MetricCard 
                            title="CPU Cores" 
                            value={data?.cpu || 0} 
                            unit=" cores" 
                            color="text-blue-500" 
                            icon="🖥️"
                          />
                          <MetricCard 
                            title="RAM Total" 
                            value={data?.memory || 0} 
                            unit=" GB" 
                            color="text-green-500" 
                            icon="💾"
                          />
                          <MetricCard 
                            title="Disk Space" 
                            value={data?.disk || 0} 
                            unit=" GB" 
                            color="text-yellow-500" 
                            icon="💿"
                          />
                          <MetricCard 
                            title="Network" 
                            value={data?.network || 'N/A'} 
                            unit="" 
                            color="text-purple-500" 
                            icon="🌐"
                          />
                        </div>

                        {/* Detalii suplimentare despre sistem */}
                        {data && (data.os || data.kernel || data.architecture) && (
                          <div className="mb-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Informații Sistem</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {data.os && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">💻</span>
                                    <span className="text-gray-700">{data.os}</span>
                                  </div>
                                )}
                                {data.kernel && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">🐧</span>
                                    <span className="text-gray-700">{data.kernel}</span>
                                  </div>
                                )}
                                {data.architecture && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">🏗️</span>
                                    <span className="text-gray-700">{data.architecture}</span>
                                  </div>
                                )}
                                {data.virtualization && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">🖥️</span>
                                    <span className="text-gray-700">{data.virtualization}</span>
                                  </div>
                                )}
                                {data.cpuFreq && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">⚡</span>
                                    <span className="text-gray-700">{data.cpuFreq}</span>
                                  </div>
                                )}
                                {data.version && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">📦</span>
                                    <span className="text-gray-700">Netdata {data.version}</span>
                                  </div>
                                )}
                                {data.hostname && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">🏠</span>
                                    <span className="text-gray-700">{data.hostname}</span>
                                  </div>
                                )}
                                {data.cloudProvider && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">☁️</span>
                                    <span className="text-gray-700">{data.cloudProvider}</span>
                                  </div>
                                )}
                                {data.instanceType && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">🖥️</span>
                                    <span className="text-gray-700">{data.instanceType}</span>
                                  </div>
                                )}
                                {data.region && (
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">🌍</span>
                                    <span className="text-gray-700">{data.region}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Informații despre datele afișate */}
                        {data && (
                          <div className="mb-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-center">
                                <span className="text-blue-600 mr-2">ℹ️</span>
                                <span className="text-sm text-blue-800">
                                  Date reale din API-ul Netdata Cloud - informații despre sistem
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Metrici secundare */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-800">
                              {data?.uptime || 0}
                            </div>
                            <div className="text-xs text-gray-600">Zile Uptime</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-800">
                              {data?.alerts || 0}
                            </div>
                            <div className="text-xs text-gray-600">Alerte</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-800">
                              {data?.metrics || 0}
                            </div>
                            <div className="text-xs text-gray-600">Metrici</div>
                          </div>
                        </div>

                        {/* Informații suplimentare */}
                        <div className="space-y-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-sm text-gray-600">
                              <strong>Status:</strong> {serverStatus[server.id] === 'online' ? '🟢 Conectat la Netdata Cloud' : '🔴 Nu se poate conecta la Netdata Cloud'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🌐</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Netdata Cloud Offline
          </h3>
          <p className="text-gray-600">
            Nu se poate conecta la Netdata Cloud. Verifică configurația.
          </p>
          {apiError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServerMonitor;