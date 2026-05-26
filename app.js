// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker Registered'));
}

let cropper = null;

// ==========================================
// Helper: Screen Navigation
// ==========================================
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ==========================================
// Screen 1 -> Screen 2: Handle File Selection (BULLETPROOF VERSION)
// ==========================================
document.getElementById('receiptImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgElement = document.getElementById('imageToCrop');
        
        // CRITICAL FIX: Wait until the image element physically finishes rendering the source
        imgElement.onload = function() {
            // 1. Move to Screen 2 safely
            switchScreen('screen2');

            // 2. Initialize Cropper now that dimensions are 100% known to the browser
            if (cropper) { cropper.destroy(); }
            cropper = new Cropper(imgElement, {
                viewMode: 1, 
                dragMode: 'crop',
                background: false,
                autoCropArea: 0.8 
            });
        };

        // Trigger the image load
        imgElement.src = event.target.result;
    };
    reader.readAsDataURL(file);
    
    e.target.value = ''; 
});

// Cancel Cropping (Go back to Screen 1)
document.getElementById('cancelCropBtn').addEventListener('click', () => {
    switchScreen('screen1');
});

// ==========================================
// Screen 2 -> Screen 3: Cropping & Scanning
// ==========================================
document.getElementById('scanBtn').addEventListener('click', async () => {
    if (!cropper) return;

    const loadingText = document.getElementById('loading');
    const scanBtn = document.getElementById('scanBtn');
    const cancelBtn = document.getElementById('cancelCropBtn');
    const itemList = document.getElementById('itemList');

    const croppedCanvas = cropper.getCroppedCanvas();
    
    loadingText.style.display = 'block';
    scanBtn.disabled = true;
    cancelBtn.disabled = true;
    itemList.innerHTML = '';

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

        const saveBtn = document.getElementById('saveBtn');
        saveBtn.innerText = "Save to Pantry";
        saveBtn.style.backgroundColor = "#2196F3";
        saveBtn.disabled = false;
        document.getElementById('startOverBtn').style.display = 'none';

        switchScreen('screen3');

    } catch (error) {
        console.error(error);
        alert('Failed to scan receipt. Please try again.');
    } finally {
        loadingText.style.display = 'none';
        scanBtn.disabled = false;
        cancelBtn.disabled = false;
    }
});

// ==========================================
// Screen 3: Handle Saving to TU/e Data Foundry
// ==========================================
document.getElementById('saveBtn').addEventListener('click', async () => {
    const saveBtn = document.getElementById('saveBtn');
    const startOverBtn = document.getElementById('startOverBtn');
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
            startOverBtn.style.display = 'block'; 
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

document.getElementById('startOverBtn').addEventListener('click', () => {
    switchScreen('screen1');
});
