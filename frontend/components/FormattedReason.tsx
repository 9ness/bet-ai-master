import React from 'react';

const FormattedReason = ({ text, className = "" }: { text?: string, className?: string }) => {
    if (!text) return null;

    // 1. Pre-process text: Replace technical terms and clean markdown bold markers
    let processedText = text.replace(/BTTS/gi, "ambos marcan");

    // Check if the text contains numbered list patterns like "1)", "2)", "1.", "2."
    const hasNumberedList = /\d+[\)\.]\s/.test(processedText);

    let parts: string[] = [];

    if (hasNumberedList) {
        const formatted = processedText.replace(/(^|\s)(\d+[\)\.])\s/g, (match, prefix, num) => {
            return `|SPLIT|${num} `;
        });
        parts = formatted.split('|SPLIT|').filter(p => p.trim().length > 0);
    } else {
        parts = [processedText];
    }

    const highlightContent = (text: string) => {
        // Remove ALL markdown asterisks physically since we handle bolding via components
        const cleanText = text.replace(/\*/g, '');

        const titleMatch = cleanText.match(/^(.{3,60}?):(\s+[\s\S]*)/);

        let titlePart = "";
        let bodyPart = cleanText;

        if (titleMatch) {
            titlePart = titleMatch[1].trim() + ":";
            bodyPart = titleMatch[2];
        }

        // Expanded Regex to catch:
        // - Percentages: 80%
        // - Odds (1-2 decimals): 1.5, 1.83, 2.10
        // - Scores/Balances: 1-1, 1-2, 0-1
        // - Fractions: 1/2
        const dataRegex = /(\d+(?:[\.,]\d+)?%|\b\d+\.\d{1,2}\b|\b\d+-\d+\b|\b\d+\/\d+\b)/g;

        const renderBody = (body: string) => {
            return body.split(dataRegex).map((chunk, i) => {
                if (dataRegex.test(chunk)) {
                    return <span key={i} className="font-bold text-foreground/90">{chunk}</span>;
                }
                return <span key={i}>{chunk}</span>;
            });
        };

        return (
            <>
                {titlePart && (
                    <strong className="text-foreground/90 font-bold block sm:inline mb-1 sm:mb-0 mr-1">
                        {titlePart}
                    </strong>
                )}
                {renderBody(bodyPart)}
            </>
        );
    };

    return (
        <ul className={`text-sm text-muted-foreground space-y-2 mt-3 text-left font-normal ${className}`}>
            {parts.map((part, idx) => {
                let content = part.trim();
                const numberMatch = content.match(/^(\d+[\)\.])\s+([\s\S]*)/);

                if (numberMatch && hasNumberedList) {
                    const [_, num, rest] = numberMatch;
                    return (
                        <li key={idx} className="flex gap-2 items-start pl-1">
                            <span className="text-primary font-bold mt-[2px] whitespace-nowrap">{num}</span>
                            <span className="leading-relaxed opacity-90 block">
                                {highlightContent(rest)}
                            </span>
                        </li>
                    );
                }

                if (!hasNumberedList && !content.endsWith('.')) content += '.';

                return (
                    <li key={idx} className="flex gap-2 items-start">
                        <span className="text-primary font-bold mt-[3px] text-[10px]">•</span>
                        <span className="leading-relaxed opacity-90 block">
                            {highlightContent(content)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

export default FormattedReason;
