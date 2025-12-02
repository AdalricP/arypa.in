// Huffman Node
class Node {
    constructor(char, freq, left = null, right = null) {
        this.char = char;
        this.freq = freq;
        this.left = left;
        this.right = right;
    }

}

// Build frequency map
function buildFrequencyMap(text) {
    const freq = {};
    for (const char of text) {
        freq[char] = (freq[char] || 0) + 1;
    }
    return freq;
}

// Build Huffman Tree
function buildHuffmanTree(freqMap) {
    const nodes = Object.entries(freqMap).map(([char, freq]) => new Node(char, freq));
    while (nodes.length > 1) {
        nodes.sort((a, b) => a.freq - b.freq);
        const left = nodes.shift();
        const right = nodes.shift();
        nodes.push(new Node(null, left.freq + right.freq, left, right));
    }
    return nodes[0];
}

// Build codes from tree
function buildCodes(node, prefix = '', codes = {}) {
    if (!node.left && !node.right) {
        codes[node.char] = prefix;
    } else {
        if (node.left) buildCodes(node.left, prefix + '0', codes);
        if (node.right) buildCodes(node.right, prefix + '1', codes);
    }
    return codes;
}

// Draw Huffman tree as SVG (with improved visuals)
function drawTree(node, svg, x, y, dx, depth = 0, parent = null, path = '', circleRadius = 22) {
    if (!node) return;
    const nodeId = 'node-' + Math.random().toString(36).substr(2, 9);
    // Calculate size reduction for this depth - make it more gradual
    const sizeReduction = Math.max(0.25, 1 - (depth * 0.15));  // Slower reduction, higher minimum
    
    // Spacing decreases with depth - more aggressive horizontal reduction
    const nextDx = (dx * Math.pow(0.6, depth));  // Exponential reduction for horizontal spacing
    const verticalSpacing = Math.max(40, 85 * sizeReduction); // Increased minimum spacing
    const nextY = y + verticalSpacing;
    const nextRadius = circleRadius * sizeReduction;
    
    if (node.left) drawTree(node.left, svg, x - nextDx, nextY, nextDx, depth + 1, { x, y }, path + '0', nextRadius);
    if (node.right) drawTree(node.right, svg, x + nextDx, nextY, nextDx, depth + 1, { x, y }, path + '1', nextRadius);
    // Draw curved path to parent (after children, so lines are behind)
    if (parent) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // Create a smooth curve between parent and child with rounder ends
        const midY = (parent.y + y) / 2;
        const curveStrength = 0.8; // Increased curve strength for rounder lines
        const d = `M ${parent.x} ${parent.y} 
                  C ${parent.x} ${parent.y + (y - parent.y) * curveStrength},
                    ${x} ${parent.y + (y - parent.y) * (1 - curveStrength)},
                    ${x} ${y}`;
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#2c3e50');
        path.setAttribute('stroke-width', Math.max(0.5, 2 - (depth * 0.4)));
        path.setAttribute('stroke-linecap', 'round'); // Round line ends
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', Math.max(0.1, Math.pow(0.7, depth))); // Exponential fade
        svg.appendChild(path);
    }

    // Draw node (circle)
    if (depth <= 6) {  // Allow nodes to go one level deeper
        const sizeReduction = Math.max(0.25, 1 - (depth * 0.15));  // More gradual reduction
        const currentRadius = circleRadius * sizeReduction;
        const fontSize = Math.max(6, currentRadius * 0.9);  // Font size proportional to node size
        
        // Only draw node and text if they're not too small to be visible
        if (currentRadius > 1) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', currentRadius);
            circle.setAttribute('fill', '#fff');
            circle.setAttribute('stroke', '#2c3e50');
            circle.setAttribute('stroke-width', Math.max(0.5, 2 * sizeReduction));
            circle.setAttribute('id', nodeId);
            circle.setAttribute('opacity', Math.max(0.1, Math.pow(0.75, depth))); // Sharper fade
            svg.appendChild(circle);
            
            // Show text for nodes up to depth 4
            if (depth <= 4) {
                const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                textEl.setAttribute('x', x);
                textEl.setAttribute('y', y + (fontSize / 3));
                textEl.setAttribute('text-anchor', 'middle');
                textEl.setAttribute('font-size', fontSize);
                textEl.setAttribute('font-family', 'Satoshi, Arial, sans-serif');
                textEl.setAttribute('font-weight', '700');
                textEl.setAttribute('id', nodeId + '-text');
                textEl.setAttribute('opacity', Math.max(0.1, Math.pow(0.75, depth))); // Match circle fade
                textEl.textContent = node.char !== null ? node.char : node.freq;
                svg.appendChild(textEl);
            }
        }
    } else {
        // For very deep nodes, keep dots more visible
        const dotRadius = Math.max(1.5, 3 - (depth * 0.25));  // Larger minimum size, slower reduction
        const numDots = 3;
        const spreadX = 20;  // Slightly larger spread
        const spreadY = 15;
        
        for (let i = 0; i < numDots; i++) {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            const randomOffsetX = (Math.random() - 0.5) * spreadX;
            const randomOffsetY = (Math.random() - 0.5) * spreadY;
            dot.setAttribute('cx', x + randomOffsetX);
            dot.setAttribute('cy', y + randomOffsetY);
            dot.setAttribute('r', dotRadius);
            dot.setAttribute('fill', '#2c3e50');
            dot.setAttribute('opacity', 0.3 + Math.random() * 0.3);
            svg.appendChild(dot);
        }
    }
    
    node._svgId = nodeId;
    node._svgX = x;
    node._svgY = y;
    node._svgRadius = circleRadius;
}

// Animate encoding with improved visuals
async function animateEncoding(tree, codes, text) {
    const svg = document.getElementById('tree-visualiser');
    let isLooping = false;
    let animationSpeed = 200; // Default 300 BPM for node transitions
    
    // Create audio elements for navigation sounds
    const leftBeep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'+Array(300).join('A'));
    const rightBoop = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'+Array(400).join('A'));
    leftBeep.type = 'audio/wav';
    rightBoop.type = 'audio/wav';
    
    // Set different frequencies for left and right
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    function playSound(isLeft) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Left: lower pitch (400Hz), Right: higher pitch (600Hz)
        oscillator.frequency.setValueAtTime(isLeft ? 400 : 600, audioContext.currentTime);
        
        // Short beep with fade out
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }
    
    // Helper to highlight a node with color and text color
    function highlightNode(node, fillColor, borderColor = '#222', textColor = '#222', enlarge = false) {
        const el = document.getElementById(node._svgId);
        const textEl = document.getElementById(node._svgId + '-text');
        if (el) {
            el.setAttribute('fill', fillColor);
            el.setAttribute('stroke', borderColor);
            // Enlarge if highlighted (not black)
            if (enlarge) {
                el.setAttribute('r', node._svgRadius * 1.13);
            } else {
                el.setAttribute('r', node._svgRadius);
            }
        }
        if (textEl) {
            textEl.setAttribute('fill', textColor);
        }
    }

    const animate = async () => {
        if (!isLooping) {
            // Reset everything when stopping
            svg.querySelectorAll('circle').forEach(c => {
                c.setAttribute('fill', '#fff');
                c.setAttribute('stroke', '#2c3e50');
                c.setAttribute('r', c.getAttribute('data-original-radius') || c.getAttribute('r'));
            });
            svg.querySelectorAll('text').forEach(t => {
                t.setAttribute('fill', '#2c3e50');
            });
            document.getElementById('sequence-display').innerHTML = '';
            return;
        }

        for (const char of text) {
            if (!isLooping) return;
            let node = tree;
            // Highlight root: orange bg, dark border, white text, enlarged
            highlightNode(node, '#ff9933', '#2c3e50', '#fff', true);
            await new Promise(r => setTimeout(r, animationSpeed));
            for (const bit of codes[char]) {
                const isLeft = bit === '0';
                node = isLeft ? node.left : node.right;
                // Play corresponding sound
                playSound(isLeft);
                // Highlight path: orange bg, dark border, white text, enlarged
                highlightNode(node, '#ff9933', '#2c3e50', '#fff', true);
                await new Promise(r => setTimeout(r, animationSpeed));
            }
            // Reset previous node highlighting and immediately start next character
            svg.querySelectorAll('circle').forEach(c => {
                c.setAttribute('fill', '#fff');
                c.setAttribute('stroke', '#2c3e50');
                c.setAttribute('r', c.getAttribute('data-original-radius') || c.getAttribute('r'));
            });
            svg.querySelectorAll('text').forEach(t => {
                t.setAttribute('fill', '#2c3e50');
            });

        // Add the character to the sequence display
        const seqDisplay = document.getElementById('sequence-display');
        const charSpan = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        charSpan.setAttribute('x', (seqDisplay.children.length * 25) + 20);  // Space characters horizontally
        charSpan.setAttribute('y', 25);  // Position from top
        charSpan.setAttribute('font-family', 'Satoshi, Arial, sans-serif');
        charSpan.setAttribute('font-size', '24');
        charSpan.setAttribute('fill', '#2c3e50');
        charSpan.textContent = char;
        
        // Animate the character appearing
        charSpan.setAttribute('opacity', '0');
        seqDisplay.appendChild(charSpan);
        
        // Fade in animation
        let opacity = 0;
        const fadeIn = () => {
            opacity += 0.1;
            charSpan.setAttribute('opacity', opacity.toString());
            if (opacity < 1) requestAnimationFrame(fadeIn);
        };
        fadeIn();
    }
    };

    // Setup controls
    const playBtn = document.getElementById('playLoopBtn');
    const bpmSlider = document.getElementById('bpmSlider');
    const bpmValue = document.getElementById('bpmValue');

    playBtn.addEventListener('click', () => {
        isLooping = !isLooping;
        playBtn.textContent = isLooping ? 'Stop' : 'Play Loop';
        if (isLooping) {
            animate();
        }
    });

    bpmSlider.addEventListener('input', (e) => {
        const bpm = parseInt(e.target.value);
        animationSpeed = Math.floor(60000 / bpm / 2); // Convert BPM to milliseconds
        bpmValue.textContent = `${bpm} BPM`;
    });
}

// Encode text and visualise
function encodeText() {
    const text = document.getElementById('text').value;
    if (!text) {
        document.getElementById('output').textContent = 'Please enter some text.';
        return;
    }
    
    // Clear and setup the sequence display area
    const treeContainer = document.getElementById('tree-visualiser');
    const existingSeqDisplay = document.getElementById('sequence-display');
    if (existingSeqDisplay) existingSeqDisplay.remove();
    
    const seqDisplay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    seqDisplay.setAttribute('id', 'sequence-display');
    seqDisplay.setAttribute('width', treeContainer.getAttribute('width'));
    seqDisplay.setAttribute('height', '50');
    seqDisplay.style.marginTop = '20px';
    seqDisplay.style.display = 'block';
    treeContainer.parentNode.insertBefore(seqDisplay, treeContainer.nextSibling);
    const freqMap = buildFrequencyMap(text);
    const tree = buildHuffmanTree(freqMap);
    const codes = buildCodes(tree);
    const encoded = text.split('').map(char => codes[char]).join('');
    
    // Create a cleaner output with dropdown
    const output = document.getElementById('output');
    // Convert codes object to table rows
    const codesTable = Object.entries(codes)
        .map(([char, code]) => `
            <tr>
                <td style="padding: 4px 12px;">${char === ' ' ? '(space)' : char}</td>
                <td style="padding: 4px 12px; font-family: monospace;">${code}</td>
            </tr>
        `).join('');

    output.innerHTML = `
        <div style="margin: 10px 0;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <button id="playLoopBtn" style="
                    padding: 4px 8px;
                    background: #e9ecef;
                    color: #2c3e50;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Satoshi, Arial, sans-serif;
                    font-size: 14px;
                ">Play Loop</button>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="range" id="bpmSlider" min="120" max="480" value="300" style="width: 100px;">
                    <span id="bpmValue" style="font-family: Satoshi, Arial, sans-serif; font-size: 14px;">300 BPM</span>
                </div>
            </div>
            <button id="showEncodingBtn" style="
                padding: 4px 8px;
                background: #e9ecef;
                color: #2c3e50;
                border: 1px solid #ced4da;
                border-radius: 4px;
                cursor: pointer;
                font-family: Satoshi, Arial, sans-serif;
                font-size: 14px;
                transition: background 0.2s;
            ">Details ▼</button>
            <div id="encodingDetails" style="
                display: none;
                margin-top: 10px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 4px;
                font-family: Satoshi, Arial, sans-serif;
                overflow-x: auto;
            ">
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: 500; margin-bottom: 4px;">Encoded:</div>
                    <div style="font-family: monospace; word-break: break-all;">${encoded}</div>
                </div>
                <div>
                    <div style="font-weight: 500; margin-bottom: 4px;">Huffman Codes:</div>
                    <table style="border-collapse: collapse; width: 100%; max-width: 300px;">
                        <tr style="background: #e9ecef; font-weight: 500;">
                            <th style="padding: 4px 12px; text-align: left;">Character</th>
                            <th style="padding: 4px 12px; text-align: left;">Code</th>
                        </tr>
                        ${codesTable}
                    </table>
                </div>
            </div>
        </div>
    `;

    // Add click handler for the dropdown
    const btn = document.getElementById('showEncodingBtn');
    const details = document.getElementById('encodingDetails');
    btn.addEventListener('click', () => {
        const isVisible = details.style.display === 'block';
        details.style.display = isVisible ? 'none' : 'block';
        btn.innerHTML = isVisible ? 'Show Encoding Details ▼' : 'Hide Encoding Details ▲';
    });

    // Calculate tree dimensions and set SVG size
    let maxDepth = 0;
    let maxWidth = 0;
    function measureTree(node, depth = 0, x = 300) {
        if (!node) return;
        maxDepth = Math.max(maxDepth, depth);
        maxWidth = Math.max(maxWidth, Math.abs(x - 300) * 2 + 100);
        const sizeReduction = Math.max(0.15, 1 - (depth * 0.2));
        const nextDx = (120 * sizeReduction) / 1.7;
        measureTree(node.left, depth + 1, x - nextDx);
        measureTree(node.right, depth + 1, x + nextDx);
    }
    measureTree(tree);

    // Set SVG dimensions
    const svg = document.getElementById('tree-visualiser');
    let totalHeight = 0;
    for (let d = 0; d <= maxDepth; d++) {
        const sizeReduction = Math.max(0.15, 1 - (d * 0.2));
        totalHeight += Math.max(30, 85 * sizeReduction);
    }
    // Add extra padding for the dots spread and general margins
    const dotSpreadPadding = 40; // Account for dot spread
    const height = totalHeight + dotSpreadPadding + 80; // Increased padding
    const width = Math.max(600, maxWidth);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.innerHTML = '';
    // Start drawing from the center
    drawTree(tree, svg, width/2, 40, width/5);
    // Animate encoding
    animateEncoding(tree, codes, text);
}
