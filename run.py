import uvicorn
import webbrowser
import threading
import time

def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    print("==================================================")
    print("      🌱 KÖLCSÖNADÓ - KÖZÖSSÉGI ESZKÖZBÉRLÉS      ")
    print("==================================================")
    print("A szerver indul a http://127.0.0.1:8000 címen...")
    print("A böngésző automatikusan megnyílik!")
    print("Leállításhoz nyomj CTRL+C-t a konzolban.")
    print("==================================================")
    
    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
