# MOAI 🗿
### Client-to-server connection wrapper
This library is a wrapper around the WebSocket API for use with Node.JS and web applications. There is also a lite version that uses [raw TCP sockets](https://nodejs.org/api/net.html) for client-to-server communication rather than [the websocket protocol](https://rfc-editor.org/rfc/rfc6455).

### Example (WebSocket)
**server.js (Node.JS server-side)**
```js
const Server = require('./server');
const server = new Server();

server.on('client', client => {
  
  client.on('packet', data => {
    // Handle data from client
  });
  
  client.on('disconnect', event => {
    // Handle client disconnect
  });
  
});

server.listen({ port: 8080, path: '/ws' });
```
**index.html (HTML client-side)**
```html
<!DOCTYPE html>
<head>
  <!-- Serializer has to be imported in html manually
  and must be a global variable. For example, moai uses
  a custom serializer although you could customize that
  by exporting Serializer#encode() and Serializer#decode()
  functions of your own.
  -->
  <script src="./serializer.js">
  <!-- Moai client-side import -->
  <script src="./client.js">
  <script>
    // Client-side code.
    let client = new Client();
    
    client.connect(new URL("ws://127.0.0.1:8080/ws"), connected => {
      if(connected) {
        // Connected
        
        client.on('packet', data => {
          // Handle data from server
        });
        
        client.on('disconnect', event => {
          // Handle disconnect
        });
        
      } else {
        // Connection failed
      }
    });
    
  </script>
</head>
```

### Why moai?
- Easy to use
- Allows transmission of JSON

### Moai-Web VS Moai-Lite
<table>
  <tr>
    <th></th>
    <th>Moai-Web</th>
    <th>Moai-Lite</th>
  </tr>
  <tr>
    <td>Protocol</td>
    <td colspan=2>TCP</td>
  </tr>
  <tr>
    <td>Serializer</td>
    <td colspan=2>SimpleSerializer</td>
  </tr>
  <tr>
    <td>Web Support</td>
    <td>✅</td>
    <td>❌</td>
  </tr>
  <tr>
    <td>Java Socket support</td>
    <td>❌</td>
    <td>✅</td>
  </tr>
</table>
