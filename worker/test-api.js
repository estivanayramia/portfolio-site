// Test error reporting endpoint
fetch('https://www.estivanayramia.com/api/error-report', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'test_error',
    message: 'Deployment verification test',
    url: 'https://www.estivanayramia.com',
    timestamp: Date.now()
  })
})
.then(res => res.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('Error:', err));
