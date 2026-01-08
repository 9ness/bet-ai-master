import path from 'path';
import fs from 'fs';

export async function getRecommendations() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'daily_bets.json');
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }
        return null;
    } catch (error) {
        console.error("Error reading recommendation file:", error);
        return null;
    }
}
