// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker Registered'));
}

let cropper = null;

// ==========================================
// 1. Handle File Selection & Setup Cropper
// ==========================================
document.getElementById('receiptImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgElement = document.getElementById('imageToCrop');
        imgElement.src = event.target.result;
        
        document.getElementById('cropContainer').style.display = 'block';
        document.getElementById('scanBtn').style.display = 'block';
        document.getElementById('resultsArea').style.display = 'none';

        if (cropper) { cropper.destroy(); }

        cropper = new Cropper(imgElement, {
            viewMode: 1, 
            dragMode: 'crop',
            background: false,
            autoCropArea: 0.8 
        });
    };
    reader.readAsDataURL(file);
});

// ==========================================
// 2. Handle Cropping and Scanning (Tesseract)
// ==========================================
document.getElementById('scanBtn').addEventListener('click', async () => {
    if (!cropper) return;

    const loadingText = document.getElementById('loading');
    const resultsArea = document.getElementById('resultsArea');
    const itemList = document.getElementById('itemList');
    const scanBtn = document.getElementById('scanBtn');

    const croppedCanvas = cropper.getCroppedCanvas();
    
    loadingText.style.display = 'block';
    resultsArea.style.display = 'none';
    itemList.innerHTML = '';
    scanBtn.disabled = true;

    try {
        const result = await Tesseract.recognize(croppedCanvas, 'nld', {
            logger: m => console.log(m) 
        });

        const textLines = result.data.text.split('\n');
        
        const validItems = textLines.filter(line => {
            const trimmed = line.trim();
            if (trimmed.length < 3) return false;
            const lowerLine = trimmed.toLowerCase();
            if (lowerLine.includes('albert heijn') || lowerLine.includes('telefoon') || lowerLine.includes('subtotaal')) {
                return false;
            }
            return true;
        });

        validItems.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'item-row';

            const span = document.createElement('span');
            span.className = 'item-text';
            let cleanText = item.trim().replace(/^[\!\|ïi\]\']/g, '1').replace(/^z /g, '2 ');
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
        
        // Reset the save button
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.innerText = "Save to Pantry";
        saveBtn.style.backgroundColor = "#2196F3";
        saveBtn.disabled = false;

    } catch (error) {
        console.error(error);
        alert('Failed to scan receipt.');
    } finally {
        loadingText.style.display = 'none';
        scanBtn.disabled = false;
    }
});

// ==========================================
// 3. Handle Saving to TU/e Data Foundry
// ==========================================
document.getElementById('saveBtn').addEventListener('click', async () => {
    const saveBtn = document.getElementById('saveBtn');
    const itemRows = document.querySelectorAll('.item-row');
    
    let parsedGroceries = [];
    
    itemRows.forEach(row => {
        const itemName = row.querySelector('.item-text').innerText;
        const category = row.querySelector('select').value;
        
        if (category !== 'ignore') {
            parsedGroceries.push({
                item: itemName,
                category: category
            });
        }
    });

    if (parsedGroceries.length === 0) {
        alert("No valid groceries to save!");
        return;
    }

    saveBtn.innerText = "Saving to Database...";
    saveBtn.disabled = true;

    var customData = { 
        groceries: parsedGroceries,
        scannedAt: new Date().toISOString() 
    };

    var jsonBody = {
        activity: 'RECEIPT_SCAN', 
        source_id: 'PWA_Prototype_Web', 
        data: JSON.stringify(customData)
    };

    try {
        const response = await fetch('https://data.id.tue.nl/api/v1/datasets/ts/21720/SWFvWmFJNmpBeStTNy8yd2UvQ1hmMEhkMitEY25GV3FBM3VkaEZ5Rm9uaz0=', {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            body: JSON.stringify(jsonBody)
        });

        if (response.ok) {
            saveBtn.innerText = "Saved Successfully!";
            saveBtn.style.backgroundColor = "#4CAF50"; 
        } else {
            throw new Error(`Server responded with status: ${response.status}`);
        }

    } catch (error) {
        console.error("Database Error:", error);
        alert("Failed to save. Check the developer console for details.");
        saveBtn.innerText = "Try Saving Again";
        saveBtn.disabled = false;
    }
});
