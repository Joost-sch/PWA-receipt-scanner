// Verification Log
console.log("🚀 app.js has successfully loaded in the browser!");

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('✅ Service Worker Registered'))
        .catch((err) => console.error('❌ Service Worker Registration Failed:', err));
}

let cropper = null;

// ==========================================
// Helper: Screen Navigation
// ==========================================
function switchScreen(screenId) {
    console.log(`📺 Attempting to switch to screen: ${screenId}`);
    const target = document.getElementById(screenId);
    if (!target) {
        console.error(`❌ CRITICAL: Screen element with ID "${screenId}" does not exist in your HTML!`);
        return;
    }
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    target.classList.add('active');
    console.log(`✨ Successfully switched to ${screenId}`);
}

// ==========================================
// Screen 1 -> Screen 2: Handle File Selection
// ==========================================
const fileInput = document.getElementById('receiptImage');
if (!fileInput) {
    console.error('❌ CRITICAL: Could not find the file input element with ID "receiptImage" in your HTML!');
} else {
    console.log('🔗 File input listener attached successfully.');
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        console.log('📸 File input triggered. Selected file:', file ? file.name : 'None');
        
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = function(event) {
            console.log('📂 FileReader successfully converted file to bytes.');
            const imgElement = document.getElementById('imageToCrop');
            
            if (!imgElement) {
                console.error('❌ CRITICAL: Could not find the HTML image element with ID "imageToCrop"!');
                return;
            }

            // Set up what happens when the image finishes rendering
            imgElement.onload = function() {
                console.log('🖼️ Image element has fully rendered the file. Now switching screens.');
                switchScreen('screen2');

                console.log('✂️ Initializing Cropper.js...');
                if (cropper) { 
                    console.log('🔄 Destroying old cropper instance.');
                    cropper.destroy(); 
                }
                
                try {
                    cropper = new Cropper(imgElement, {
                        viewMode: 1, 
                        dragMode: 'crop',
                        background: false,
                        autoCropArea: 0.8 
                    });
                    console.log('✅ Cropper.js successfully initialized!');
                } catch (cropperError) {
                    console.error('❌ Cropper.js failed to initialize:', cropperError);
                }
            };

            // Catch image loading errors
            imgElement.onerror = function(imgErr) {
                console.error('❌ The HTML image element failed to load the provided data source:', imgErr);
            };

            console.log('📥 Passing file data to the image source attribute...');
            imgElement.src = event.target.result;
        };

        reader.onerror = function(readerErr) {
            console.error('❌ FileReader broke while reading the file:', readerErr);
        };

        reader.readAsDataURL(file);
        e.target.value = ''; 
    });
}

// ==========================================
// Screen 2 -> Screen 3: Cropping & Scanning
// ==========================================
document.getElementById('scanBtn').addEventListener('click', async () => {
    console.log('🔍 "Analyze Receipt" button clicked.');
    if (!cropper) {
        console.error('❌ Cannot scan: Cropper instance is null.');
        return;
    }

    const loadingText = document.getElementById('loading');
    const scanBtn = document.getElementById('scanBtn');
    const cancelBtn = document.getElementById('cancelCropBtn');
    const itemList = document.getElementById('itemList');

    const croppedCanvas = cropper.getCroppedCanvas();
    console.log('🎨 Cropped canvas generated successfully.');
    
    loadingText.style.display = 'block';
    scanBtn.disabled = true;
    cancelBtn.disabled = true;
    itemList.innerHTML = '';

    try {
        console.log('🤖 Sending cropped image to Tesseract AI...');
        const result = await Tesseract.recognize(croppedCanvas, 'nld', {
            logger: m => console.log(`AI Progress: ${m.status} -> ${Math.round(m.progress * 100)}%`) 
        });

        console.log('📝 Text extraction complete. Processing lines...');
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
        saveBtn.style.backgroundColor = "#84bc41";
        saveBtn.disabled = false;
        document.getElementById('startOverBtn').style.display = 'none';

        switchScreen('screen3');

    } catch (error) {
        console.error('❌ Tesseract OCR broke:', error);
        alert('Failed to scan receipt. Please try again.');
    } finally {
        loadingText.style.display = 'none';
        scanBtn.disabled = false;
        cancelBtn.disabled = false;
    }
});

// Cancel Cropping
document.getElementById('cancelCropBtn').addEventListener('click', () => {
    switchScreen('screen1');
});

// ==========================================
// Screen 3: Handle Saving to TU/e Data Foundry
// ==========================================
document.getElementById('saveBtn').addEventListener('click', async () => {
    console.log('💾 "Save to Pantry" button clicked.');
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
        console.log('🌐 Sending payload to TU/e Data Foundry...');
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
            console.log('🎉 Data successfully recorded by database!');
            saveBtn.innerText = "Saved Successfully!";
            saveBtn.style.backgroundColor = "#84bc41"; 
            startOverBtn.style.display = 'block'; 
        } else {
            throw new Error(`Server responded with status: ${response.status}`);
        }

    } catch (error) {
        console.error("❌ Database Error:", error);
        alert("Failed to save. Check the developer console for details.");
        saveBtn.innerText = "Try Saving Again";
        saveBtn.disabled = false;
    }
});

document.getElementById('startOverBtn').addEventListener('click', () => {
    switchScreen('screen1');
});
