from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

print("SUPABASE URL:", SUPABASE_URL)
print("KEY STARTS:", SUPABASE_KEY[:20])

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)