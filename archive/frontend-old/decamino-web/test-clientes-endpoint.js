// Test pentru endpoint-ul de clienți
const testClientesEndpoint = async () => {
  try {
    console.log('Testing clientes endpoint...');
    
    const response = await fetch('http://localhost:5173/webhook/ed97e937-bb85-4b58-967b-d41bbd84ac47');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Endpoint funcționează!');
    console.log('📊 Total clienți:', data.length);
    console.log('📋 Primul client:', data[0]);
    
    // Afișează câțiva clienți ca exemplu
    console.log('\n📋 Exemple de clienți:');
    data.slice(0, 3).forEach((cliente, index) => {
      console.log(`${index + 1}. ${cliente['NOMBRE O RAZON SOCIAL']} - ${cliente.NIF}`);
    });
    
  } catch (error) {
    console.error('❌ Eroare la testarea endpoint-ului:', error);
  }
};

// Rulează testul
testClientesEndpoint(); 