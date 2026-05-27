if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker Registered'));
}

let cropper = null;
let extractedGroceries = []; // We will store Gemini's output here

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ==========================================
// File Selection & Cropper
// ==========================================
document.getElementById('receiptImage').addEventListener('change', function(e) {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) {
        alert("Please paste your Gemini API Key before continuing.");
        e.target.value = ''; 
        return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgElement = document.getElementById('imageToCrop');
        
        imgElement.onload = function() {
            switchScreen('screen2');
            if (cropper) { cropper.destroy(); }
            cropper = new Cropper(imgElement, {
                viewMode: 1, 
                dragMode: 'crop',
                background: false,
                autoCropArea: 0.8 
            });
        };
        imgElement.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
});

document.getElementById('cancelCropBtn').addEventListener('click', () => {
    switchScreen('screen1');
});

// ==========================================
// Send to Gemini AI
// ==========================================
document.getElementById('scanBtn').addEventListener('click', async () => {
    if (!cropper) return;

    const apiKey = document.getElementById('apiKey').value.trim();
    const loadingText = document.getElementById('loading');
    const scanBtn = document.getElementById('scanBtn');
    const cancelBtn = document.getElementById('cancelCropBtn');
    const itemList = document.getElementById('itemList');

    const croppedCanvas = cropper.getCroppedCanvas();
    const base64Image = croppedCanvas.toDataURL('image/jpeg').split(',')[1];
    
    loadingText.style.display = 'block';
    scanBtn.disabled = true;
    cancelBtn.disabled = true;
    itemList.innerHTML = '';

    const promptText = `
        You are a smart grocery parser. Look at this cropped receipt.
        Extract the grocery items and their quantities. 
        Categorize each item as exactly "common" (for general household/pantry staples like milk, toilet paper, butter) or "individual" (for specific dinner ingredients like meat, vegetables, pasta).
        Ignore store names, phone numbers, subtotals, and prices.
        Return ONLY a raw JSON array of objects. Do not use markdown code blocks.
        Example format: [{"item": "Rundergehakt", "quantity": "1", "category": "individual"}]
    `;

    const requestBody = {
        contents: [{
            parts: [
                { text: promptText },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error("API Request Failed. Check your API Key.");

        const data = await response.json();
        
        // Clean up response in case Gemini includes markdown ```json formatting
        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        extractedGroceries = JSON.parse(rawText);

        // Populate the UI with read-only data
        extractedGroceries.forEach((grocery) => {
            const row = document.createElement('div');
            row.className = 'item-row';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-text';
            nameSpan.innerText = `${grocery.quantity}x ${grocery.item}`;

            const tagSpan = document.createElement('span');
            tagSpan.className = 'item-category';
            tagSpan.innerText = grocery.category;

            row.appendChild(nameSpan);
            row.appendChild(tagSpan);
            itemList.appendChild(row);
        });

        const saveBtn = document.getElementById('saveBtn');
        saveBtn.innerText = "Save to Pantry";
        saveBtn.style.backgroundColor = "#84bc41";
        saveBtn.disabled = false;
        document.getElementById('startOverBtn').style.display = 'none';

        switchScreen('screen3');

    } catch (error) {
        console.error(error);
        alert('Failed to process with Gemini. Please try again or check your API key.');
    } finally {
        loadingText.style.display = 'none';
        scanBtn.disabled = false;
        cancelBtn.disabled = false;
    }
});

// ==========================================
// Save to TU/e Database
// ==========================================
document.getElementById('saveBtn').addEventListener('click', async () => {
    const saveBtn = document.getElementById('saveBtn');
    const startOverBtn = document.getElementById('startOverBtn');

    if (extractedGroceries.length === 0) {
        alert("No valid groceries to save!");
        return;
    }

    saveBtn.innerText = "Saving to Database...";
    saveBtn.disabled = true;

    // Use the perfectly formatted JSON array directly from Gemini
    var customData = { 
        groceries: extractedGroceries,
        scannedAt: new Date().toISOString() 
    };

    var jsonBody = {
        activity: 'RECEIPT_SCAN', 
        source_id: 'PWA_Prototype_Web', 
        data: JSON.stringify(customData)
    };

    try {
        const response = await fetch('[https://data.id.tue.nl/api/v1/datasets/ts/21720/SWFvWmFJNmpBeStTNy8yd2UvQ1hmMEhkMitEY25GV3FBM3VkaEZ5Rm9uaz0=](https://data.id.tue.nl/api/v1/datasets/ts/21720/SWFvWmFJNmpBeStTNy8yd2UvQ1hmMEhkMitEY25GV3FBM3VkaEZ5Rm9uaz0=)', {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonBody)
        });

        if (response.ok) {
            saveBtn.innerText = "Saved Successfully!";
            saveBtn.style.backgroundColor = "#45a049"; 
            startOverBtn.style.display = 'block'; 
        } else {
            throw new Error(`Server responded with status: ${response.status}`);
        }

    } catch (error) {
        console.error("Database Error:", error);
        alert("Failed to save. Check the developer console for details.");
        saveBtn.innerText = "Try Saving Again";
        saveBtn.style.backgroundColor = "#84bc41"; 
        saveBtn.disabled = false;
    }
});

document.getElementById('startOverBtn').addEventListener('click', () => {
    switchScreen('screen1');
    document.getElementById('receiptImage').value = ''; // Reset file input
});
