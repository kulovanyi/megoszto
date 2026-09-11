# -*- coding: utf-8 -*-
import os
import sys
import json
import time
import hashlib
import base64
import secrets
import urllib.parse
import urllib.request
import webbrowser
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler

PROJECT_ID = 'kolcsonadlak-7212a'
SITE_ID = 'kolcsonadlak-7212a'
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/firebase',
    'https://www.googleapis.com/auth/cloud-platform'
]
TOKEN_FILE = os.path.join(BASE_DIR, '.firebase_token.json')

def sync_public_dir():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(os.path.join(PUBLIC_DIR, 'static'), exist_ok=True)
    for f in ['index.html', 'landing.html', 'robots.txt', 'sitemap.xml']:
        src = os.path.join(BASE_DIR, f)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(PUBLIC_DIR, f))
    static_src = os.path.join(BASE_DIR, 'static')
    if os.path.exists(static_src):
        for item in os.listdir(static_src):
            s_path = os.path.join(static_src, item)
            d_path = os.path.join(PUBLIC_DIR, 'static', item)
            if os.path.isfile(s_path):
                shutil.copy2(s_path, d_path)

def generate_code_verifier():
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('ascii').rstrip('=')

def generate_code_challenge(verifier):
    digest = hashlib.sha256(verifier.encode('ascii')).digest()
    return base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    auth_code = None
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if 'code' in params:
            OAuthCallbackHandler.auth_code = params['code'][0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            msg = 'Sikeres Google Bejelentkezes! Visszaterhetsz a fekete ablakba.'
            self.wfile.write(msg.encode('utf-8'))
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'Error: No auth code found.')

    def log_message(self, format, *args):
        pass

def get_tokens_via_browser():
    print('\n[1/4] Google Bejelentkezes inditasa a bongeszoben...')
    verifier = generate_code_verifier()
    challenge = generate_code_challenge(verifier)
    state = secrets.token_hex(16)
    server = HTTPServer(('127.0.0.1', 9005), OAuthCallbackHandler)
    server.timeout = 180
    redirect_uri = 'http://127.0.0.1:9005'
    auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': ' '.join(SCOPES),
        'state': state,
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
        'access_type': 'offline',
        'prompt': 'consent'
    })
    print('  -> Bongeszo megnyitasa az engedelyezeshez...')
    webbrowser.open(auth_url)
    while OAuthCallbackHandler.auth_code is None:
        server.handle_request()
    code = OAuthCallbackHandler.auth_code
    print('  -> Token lekerese a Google szerverrol...')
    token_url = 'https://oauth2.googleapis.com/token'
    data = urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code': code,
        'code_verifier': verifier,
        'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri
    }).encode('utf-8')
    req = urllib.request.Request(token_url, data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(req) as resp:
        tokens = json.loads(resp.read().decode('utf-8'))
    tokens['expires_at'] = time.time() + tokens.get('expires_in', 3600)
    with open(TOKEN_FILE, 'w', encoding='utf-8') as f:
        json.dump(tokens, f, indent=2)
    return tokens

def get_valid_access_token():
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, 'r', encoding='utf-8') as f:
                tokens = json.load(f)
            if tokens.get('expires_at', 0) > time.time() + 60:
                return tokens['access_token']
            if 'refresh_token' in tokens:
                print('  -> Token automatikus frissitese...')
                token_url = 'https://oauth2.googleapis.com/token'
                data = urllib.parse.urlencode({
                    'client_id': CLIENT_ID,
                    'client_secret': CLIENT_SECRET,
                    'refresh_token': tokens['refresh_token'],
                    'grant_type': 'refresh_token'
                }).encode('utf-8')
                req = urllib.request.Request(token_url, data=data, method='POST')
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                with urllib.request.urlopen(req) as resp:
                    new_tok = json.loads(resp.read().decode('utf-8'))
                tokens['access_token'] = new_tok['access_token']
                tokens['expires_at'] = time.time() + new_tok.get('expires_in', 3600)
                with open(TOKEN_FILE, 'w', encoding='utf-8') as f:
                    json.dump(tokens, f, indent=2)
                return tokens['access_token']
        except Exception:
            pass
    tokens = get_tokens_via_browser()
    return tokens['access_token']

def make_api_request(url, method='GET', data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            if content:
                return json.loads(content.decode('utf-8'))
            return {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        print(f'API Error ({e.code}): {err_body}')
        raise

def collect_files():
    files = {}
    for root, _, filenames in os.walk(PUBLIC_DIR):
        for fn in filenames:
            abs_path = os.path.join(root, fn)
            rel_path = os.path.relpath(abs_path, PUBLIC_DIR).replace('\\', '/')
            if not rel_path.startswith('/'):
                rel_path = '/' + rel_path
            with open(abs_path, 'rb') as f:
                content = f.read()
            sha256 = hashlib.sha256(content).hexdigest()
            files[rel_path] = {
                'hash': sha256,
                'content': content,
                'abs_path': abs_path
            }
    return files

def deploy():
    print('=' * 60)
    print('  KOLCSONADLAK.HU - FIREBASE HOSTING VEGLEGES FELTOLTES')
    print(f'  Projekt: {PROJECT_ID}')
    print(f'  Webhely mappa: {PUBLIC_DIR}')
    print('=' * 60)
    sync_public_dir()
    access_token = get_valid_access_token()
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    print('\n[2/4] Fajlok osszegyujtese es ellenorzese...')
    files = collect_files()
    print(f'  -> Osszesen {len(files)} fajl elokeszitve a public mappabol.')
    print('\n[3/4] Uj verzio letrehozasa a Firebase Hosting-on...')
    create_url = f'https://firebasehosting.googleapis.com/v1beta1/sites/{SITE_ID}/versions'
    version_config = {
        'config': {
            'cleanUrls': True,
            'rewrites': [{'glob': '**', 'path': '/index.html'}]
        }
    }
    version_resp = make_api_request(
        create_url, 
        method='POST', 
        data=json.dumps(version_config).encode('utf-8'),
        headers=headers
    )
    version_name = version_resp.get('name')
    print(f'  -> Verzioszam letrejott: {version_name}')
    hash_to_path = {f['hash']: path for path, f in files.items()}
    populate_url = f'https://firebasehosting.googleapis.com/v1beta1/{version_name}:populateFiles'
    populate_data = {
        'files': {path: f['hash'] for path, f in files.items()}
    }
    pop_resp = make_api_request(
        populate_url,
        method='POST',
        data=json.dumps(populate_data).encode('utf-8'),
        headers=headers
    )
    upload_url = pop_resp.get('uploadUrl')
    upload_required_hashes = pop_resp.get('uploadRequiredHashes', [])
    print(f'  -> Feltoltendo uj fajlok szama: {len(upload_required_hashes)}')
    for h in upload_required_hashes:
        file_path = hash_to_path.get(h)
        file_info = files[file_path]
        print(f'     Feltoltes: {file_path}...')
        target_upload_url = f'{upload_url}/{h}'
        raw_content = file_info['content']
        req = urllib.request.Request(target_upload_url, data=raw_content, method='POST')
        req.add_header('Authorization', f'Bearer {access_token}')
        req.add_header('Content-Type', 'application/octet-stream')
        with urllib.request.urlopen(req) as resp:
            pass
    print('\n[4/4] Verzio veglegesitese es elesitese...')
    finalize_url = f'https://firebasehosting.googleapis.com/v1beta1/{version_name}?update_mask=status'
    finalize_data = {'status': 'FINALIZED'}
    make_api_request(
        finalize_url,
        method='PATCH',
        data=json.dumps(finalize_data).encode('utf-8'),
        headers=headers
    )
    release_url = f'https://firebasehosting.googleapis.com/v1beta1/sites/{SITE_ID}/releases?versionName={version_name}'
    make_api_request(
        release_url,
        method='POST',
        headers=headers
    )
    print('\n' + '=' * 60)
    print('  SIKERESEN ELESEDETT A KOLCSONADLAK.HU A FIREBASE-EN!')
    print('=' * 60)
    print(f'\nAz oldal mar elerheto:')
    print(f'  1. https://{SITE_ID}.web.app')
    print(f'  2. https://{SITE_ID}.firebaseapp.com')
    print('=' * 60 + '\n')
    try:
        webbrowser.open(f'https://{SITE_ID}.web.app')
    except Exception:
        pass

if __name__ == '__main__':
    try:
        deploy()
    except Exception as e:
        print(f'\nHIBA TORTENT: {e}')
        import traceback
        traceback.print_exc()
