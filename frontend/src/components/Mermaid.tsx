import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
    chart: string;
}

mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
});

export default function Mermaid({ chart }: MermaidProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            mermaid.contentLoaded();
            // Ensure the chart is rendered when the component mounts or chart changes
            const renderChart = async () => {
                try {
                    // Clear previous content
                    ref.current!.innerHTML = '';
                    const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart);
                    if (ref.current) {
                        ref.current.innerHTML = svg;
                    }
                } catch (error) {
                    console.error('Mermaid render error:', error);
                    if (ref.current) {
                        ref.current.innerHTML = `<pre class="text-red-500 p-2 border border-red-200 rounded bg-red-50">Mermaid Error: ${error}</pre>`;
                    }
                }
            };
            renderChart();
        }
    }, [chart]);

    return <div ref={ref} className="mermaid flex justify-center my-4 overflow-auto" />;
}
