// Register Service Worker for PWA installation
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
        console.log('Service Worker Registered');
    });
}

document.getElementById('scanBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('receiptImage');
    const loadingText = document.getElementById('loading');
    const resultsArea = document.getElementById('resultsArea');
    const itemList = document.getElementById('itemList');

    if (fileInput.files.length === 0) {
        alert('Please select or capture an image first!');
        return;
    }

    const imageFile = fileInput.files[0];
    
    // UI updates during scanning
    loadingText.style.display = 'block';
    resultsArea.style.display = 'none';
    itemList.innerHTML = '';
    document.getElementById('scanBtn').disabled = true;

  try {
        // 1. Change 'eng' to 'nld' (Dutch)
        const result = await Tesseract.recognize(imageFile, 'nld', {
            logger: m => console.log(m)
        });

        const textLines = result.data.text.split('\n');
        
        // 2. Smarter Filtering
        const validItems = textLines.filter(line => {
            const trimmed = line.trim();
            // Ignore very short lines
            if (trimmed.length < 5) return false;
            // Ignore common receipt headers/footers
            const lowerLine = trimmed.toLowerCase();
            if (lowerLine.includes('albert heijn') || 
                lowerLine.includes('telefoon') || 
                lowerLine.includes('subtotaal') ||
                lowerLine.includes('bonuskaart') ||
                lowerLine.includes('uw voordeel')) {
                return false;
            }
            return true;
        });

        // Populate the UI
        validItems.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'item-row';

            const span = document.createElement('span');
            span.className = 'item-text';
            
            // Clean up the weird exclamation marks at the start of lines
            let cleanText = item.trim().replace(/^!/g, '1'); 
            span.innerText = cleanText;

            const select = document.createElement('select');
            select.innerHTML = `
                <option value="common">Common/Household</option>
                <option value="individual">Individual/Dinner</option>
                <option value="ignore">Ignore</option>
            `;

            row.appendChild(span);
            row.appendChild(select);
            itemList.appendChild(row);
        });

        resultsArea.style.display = 'block';

    } catch (error) {
        console.error(error);
        alert('Failed to scan receipt. Please try again with a clearer photo.');
    } finally {
        loadingText.style.display = 'none';
        document.getElementById('scanBtn').disabled = false;
    }
});
