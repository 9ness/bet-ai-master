import { NextResponse } from 'next/server';
import gis from 'g-i-s';

export async function POST(request: Request) {
    try {
        const { query } = await request.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        // Add "football" context to the query for better results
        const optimizedQuery = `${query} football match vertical`;

        console.log(`Searching for: ${optimizedQuery}`);

        // Wrap gis in a promise
        const searchGoogle = (q: string): Promise<any[]> => {
            return new Promise((resolve, reject) => {
                gis(q, (err: any, results: any[]) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
        };

        const results = await searchGoogle(optimizedQuery);

        // Deduplicate results
        const seen = new Set();
        const uniqueResults = results.filter((res: any) => {
            if (seen.has(res.url)) return false;
            seen.add(res.url);
            return true;
        });

        // Map results. gis returns { url, width, height }
        const images = uniqueResults.slice(0, 80).map((res: any) => ({
            url: res.url,
            thumbnail: res.url, // gis doesn't always provide thumb, use full url
            title: "Google Image", // gis doesn't provide title
            width: res.width,
            height: res.height
        }));

        return NextResponse.json({ images });

    } catch (error) {
        console.error("Search Error:", error);
        return NextResponse.json({ error: "Failed to search images" }, { status: 500 });
    }
}
