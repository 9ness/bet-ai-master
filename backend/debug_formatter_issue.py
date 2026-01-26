
from src.services.bet_formatter import BetFormatter

formatter = BetFormatter()

# Case causing the issue
player_name = "Cengiz Under"
market = "Over 2.5 Shots"
input_str = f"{market} {player_name}" # "Over 2.5 Shots Cengiz Under" -> "Más de 2.5 Remates Cengiz Menos de"

print(f"Input: {input_str}")
output = formatter.translate_pick(input_str)
print(f"Output: {output}")

# Other cases to ensure regression testing
cases = [
    "Under 2.5 Goals",
    "Over 1.5 Goals",
    "Player Total Shots: Cengiz Under",
    "Cengiz Under to Score",
    "Under 3.5 Cards",
    "Over 0.5 Assists"
]

print("\n--- Testing Cases ---")
for c in cases:
    print(f"Original: {c} -> Trans: {formatter.translate_pick(c)}")
