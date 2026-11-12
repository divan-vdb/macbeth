# Local server that mimics a strict host's content security policy,
# so failures like blocked data: fetches show up before publishing.
import http.server, functools, sys, os
CSP = ("default-src 'self'; "
       "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; "
       "img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:")
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1])
http.server.ThreadingHTTPServer(('', port), functools.partial(H, directory=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))).serve_forever()
