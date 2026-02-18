import re

def test_regex():
    keywords = ["corner", "tarjeta", "card", "tiro", "remate", "shot"]
    
    test_cases = [
        ("hándicap asiático -1 cardiff", False),
        ("más de 2.5 cards", True),
        ("más de 8.5 corners", True),
        ("tiro a puerta", True),
        ("shrewsbury vs cardiff", False),
        ("remate de cabeza", True),
        ("tarjetas amarillas", True)
    ]
    
    for pick, expected in test_cases:
        # Simulate unidecode and lower
        clean_pick = pick.lower() # simplifies for this test
        match = any(re.search(rf'\b{x}(s|es)?\b', clean_pick) for x in keywords)
        result = bool(match)
        print(f"Pick: '{pick}' | Expected: {expected} | Result: {result} | {'OK' if result == expected else 'FAIL'}")

if __name__ == "__main__":
    test_regex()
