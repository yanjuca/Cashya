# Cashya API

Backend local do Cashya, construído com FastAPI e SQLite. Nenhum serviço externo é necessário.

## Executar no Windows

```powershell
cd cashya-api
py -m venv .venv
.venv\Scripts\Activate.ps1  
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

A API fica em `http://127.0.0.1:8000` e a documentação em `/docs`.

Para o Expo, use `http://10.0.2.2:8000` no emulador Android, `http://127.0.0.1:8000` no simulador iOS ou o IP local do computador em um celular físico.


