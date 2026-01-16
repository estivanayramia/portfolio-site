import http.server
import socketserver
import os
import sys

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Get the path from the request
        path = self.path.split('?')[0]
        
        # If it's a directory, let the parent class handle it (it looks for index.html)
        if path.endswith('/'):
            super().do_GET()
            return

        # Check if the file exists
        if os.path.exists(os.getcwd() + path):
            super().do_GET()
            return

        # Try appending .html
        if os.path.exists(os.getcwd() + path + ".html"):
            self.path = path + ".html"
            super().do_GET()
            return
            
        # If still not found, maybe it's a rewrite rule from _redirects (simplified)
        # For now, just try to serve 404.html if it exists, or let default 404 happen
        if os.path.exists("404.html"):
            self.path = "/404.html"
            super().do_GET()
            return
            
        super().do_GET()

Handler = CustomHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
