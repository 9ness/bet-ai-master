import google.generativeai as genai
import os
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
potential_paths = [
    os.path.join(current_dir, '../../.env.local'),
    os.path.join(current_dir, '../.env.local'), 
    os.path.join(current_dir, '../../.env'),
]

found = False
for p in potential_paths:
    if os.path.exists(p):
        load_dotenv(p)
        found = True
        break

if not found:
    print("WARNING: No .env found in upper dirs.")

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print(f"No API KEY found.")
    exit()

genai.configure(api_key=api_key)

output_path = os.path.join(current_dir, 'available_models.txt')

try:
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("Available Models:\n")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                f.write(f"{m.name}\n")
    print(f"Models saved to {output_path}")
except Exception as e:
    print(f"Error listing models: {e}")
