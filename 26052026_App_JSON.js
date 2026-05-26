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
        // Run Tesseract OCR
        const result = await Tesseract.recognize(imageFile, 'eng', {
            logger: m => console.log(m) // Logs progress in console
        });

        // Clean and process the extracted text
        const textLines = result.data.text.split('\n');
        
        // Filter out empty lines or garbage characters (basic cleanup)
        const validItems = textLines.filter(line => line.trim().length > 2);

        // Populate the UI
        validItems.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'item-row';

            // Item Name
            const span = document.createElement('span');
            span.className = 'item-text';
            span.innerText = item.trim();

            // Categorization Dropdown
            const select = document.createElement('select');
            select.innerHTML = `
                <option value="common">Common/Household</option>
                <option value="individual">Individual/Dinner</option>
                <option value="ignore">Ignore (Not a grocery)</option>
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