// Register Service Worker for PWA installation
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker Registered'));
}

let cropper = null; // Variable to hold the Cropper instance

// 1. Handle File Selection & Setup Cropper
document.getElementById('receiptImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgElement = document.getElementById('imageToCrop');
        imgElement.src = event.target.result;
        
        // Show the cropper container and the scan button
        document.getElementById('cropContainer').style.display = 'block';
        document.getElementById('scanBtn').style.display = 'block';
        document.getElementById('resultsArea').style.display = 'none';

        // Destroy the old cropper if it exists (if the user picks a new photo)
        if (cropper) { cropper.destroy(); }

        // Initialize Cropper.js
        cropper = new Cropper(imgElement, {
            viewMode: 1, // Restrict crop box to not exceed canvas size
            dragMode: 'crop',
            background: false,
            autoCropArea: 0.8 // Start with a fairly large crop box
        });
    };
    reader.readAsDataURL(file);
});

// 2. Handle Cropping and Scanning
document.getElementById('scanBtn').addEventListener('click', async () => {
    if (!cropper) return;

    const loadingText = document.getElementById('loading');
    const resultsArea = document.getElementById('resultsArea');
    const itemList = document.getElementById('itemList');

    // Get the cropped image as a Canvas object
    const croppedCanvas = cropper.getCroppedCanvas();
    
    // UI updates
    loadingText.style.display = 'block';
    resultsArea.style.display = 'none';
    itemList.innerHTML = '';
    document.getElementById('scanBtn').disabled = true;

    try {
        // Feed the Cropped Canvas directly to Tesseract
        const result = await Tesseract.recognize(croppedCanvas, 'nld', {
            logger: m => console.log(m) 
        });

        const textLines = result.data.text.split('\n');
        
        // Smarter Filtering (Kept from previous step)
        const validItems = textLines.filter(line => {
            const trimmed = line.trim();
            if (trimmed.length < 3) return false;
            const lowerLine = trimmed.toLowerCase();
            if (lowerLine.includes('albert heijn') || lowerLine.includes('telefoon') || lowerLine.includes('subtotaal')) {
                return false;
            }
            return true;
        });

        // Populate UI
        validItems.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'item-row';

            const span = document.createElement('span');
            span.className = 'item-text';
            
            // Basic clean up: Force weird leading characters back to numbers if needed
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

    } catch (error) {
        console.error(error);
        alert('Failed to scan receipt. Please try again.');
    } finally {
        loadingText.style.display = 'none';
        document.getElementById('scanBtn').disabled = false;
    }
});
