// Global variables
let results = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    if (localStorage.theme === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // Initialize file input handler
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    // Initialize "All" filter as active by default
    const allButton = document.querySelector('[data-filter="all"]');
    if (allButton) {
        allButton.classList.add('active');
    }
});

// Theme toggle
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const fileContent = e.target.result;
            const fileName = file.name.toLowerCase();
            
            if (fileName.endsWith('.sarif')) {
                processSarifFile(fileContent);
            } else {
                processSemgrepJsonFile(fileContent);
            }
            
            updateUI();
        } catch (error) {
            alert('Error processing file: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        alert('Error reading file');
    };
    
    reader.readAsText(file);
}

// Process Semgrep JSON file
function processSemgrepJsonFile(fileContent) {
    const report = JSON.parse(fileContent);
    results = report.results.map(f => {
        // Determine severity, checking all possible locations
        let severity = (f.severity || f.extra?.severity || f.extra?.metadata?.severity || 'UNKNOWN').toUpperCase();
        
        return {
            ...f,
            severity: severity,
            code: f.extra?.lines || '',
            extra: {
                ...f.extra,
                metadata: {
                    ...f.extra?.metadata,
                    tags: f.extra?.metadata?.tags || [],
                    confidence: f.extra?.metadata?.confidence || 'UNKNOWN'
                }
            }
        };
    });
}

// Process SARIF file
function processSarifFile(fileContent) {
    const report = JSON.parse(fileContent);
    results = report.runs.flatMap(run => 
        run.results.map(result => ({
            check_id: result.ruleId,
            path: result.locations[0].physicalLocation.artifactLocation.uri,
            start: {
                line: result.locations[0].physicalLocation.region.startLine
            },
            end: {
                line: result.locations[0].physicalLocation.region.endLine
            },
            severity: result.level || 'UNKNOWN',
            extra: {
                message: result.message.text,
                metadata: {
                    severity: result.level || 'UNKNOWN',
                    category: result.properties?.category,
                    tags: result.properties?.tags || [],
                    confidence: result.properties?.confidence || 'UNKNOWN'
                },
                lines: result.locations[0].physicalLocation.region.snippet?.text || ''
            }
        }))
    );
}

// Update UI with results
function updateUI() {
    // Update counts
    const counts = {
        total: results.length,
        info: results.filter(f => f.severity === 'INFO').length,
        low: results.filter(f => f.severity === 'LOW').length,
        medium: results.filter(f => f.severity === 'MEDIUM').length,
        high: results.filter(f => f.severity === 'HIGH').length,
        critical: results.filter(f => f.severity === 'CRITICAL').length
    };
    
    document.getElementById('count-total').textContent = counts.total;
    document.getElementById('count-info').textContent = counts.info;
    document.getElementById('count-low').textContent = counts.low;
    document.getElementById('count-medium').textContent = counts.medium;
    document.getElementById('count-high').textContent = counts.high;
    document.getElementById('count-critical').textContent = counts.critical;
    
    // Update results container
    const resultsContainer = document.getElementById('results-container');
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-600 dark:text-gray-400">Upload a Semgrep results file to view the report</p>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = results.map(finding => `
        <div class="result-card p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4
            ${getSeverityClass(finding.severity)}" 
            data-severity="${finding.severity}">
            
            <!-- Заголовок с check_id и severity badge -->
            <div class="flex flex-col gap-2 mb-6">
                <div class="flex justify-between items-start">
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-white break-all leading-normal">${finding.check_id}</h3>
                    <span class="px-2.5 py-1 ml-2 text-xs font-medium rounded-full ${getSeverityTextClass(finding.severity)}">${finding.severity}</span>
                </div>
                
                <!-- Сообщение об ошибке -->
                <div class="text-gray-800 dark:text-gray-200 text-sm break-words leading-relaxed">
                    ${finding.extra.message}
                </div>
            </div>

            <!-- Код -->
            ${finding.code ? `
                <div class="mb-6">
                    <pre class="bg-[#1e1e1e] text-white p-4 rounded-md text-sm overflow-x-auto font-mono"><code class="whitespace-pre">${finding.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                </div>
            ` : ''}

            <!-- Путь к файлу -->
            <div class="mb-4">
                <div class="text-sm text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-2">
                    <span class="font-medium whitespace-nowrap">File:</span>
                    <code class="text-gray-800 dark:text-gray-200 break-all font-mono">${finding.path}</code>
                </div>
            </div>

            <!-- Дополнительная информация -->
            <div class="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div class="flex items-center gap-2">
                    <span class="whitespace-nowrap">Confidence:</span>
                    <span class="text-gray-700 dark:text-gray-300">${finding.extra.metadata.confidence || 'UNKNOWN'}</span>
                </div>

                ${finding.extra.metadata.category ? `
                    <div class="flex items-center gap-2">
                        <span class="whitespace-nowrap">Category:</span>
                        <span class="text-gray-700 dark:text-gray-300">${finding.extra.metadata.category}</span>
                    </div>
                ` : ''}

                <div class="flex items-center gap-2">
                    <span class="whitespace-nowrap">Line:</span>
                    <span class="text-gray-700 dark:text-gray-300">${finding.start.line}-${finding.end.line}</span>
                </div>
            </div>

            ${finding.extra.metadata.tags?.length ? `
                <div class="mt-4 flex flex-wrap gap-2">
                    ${finding.extra.metadata.tags.map(tag => `
                        <span class="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    // Apply current filter
    const activeFilterButton = document.querySelector('.filter-button.active');
    if (activeFilterButton) {
        filterResults(activeFilterButton.dataset.filter);
    } else {
        // Default to showing all if no active filter
        filterResults('all');
    }
}

// Filter results by severity
function filterResults(severity) {
    // Mark active filter button
    document.querySelectorAll('.filter-button').forEach(button => {
        if (button.dataset.filter === severity) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Filter results
    document.querySelectorAll('.result-card').forEach(card => {
        card.style.display =
            severity === 'all' || card.dataset.severity === severity ?
            'block' : 'none';
    });
}

// Get severity border class
function getSeverityClass(severity) {
    const classes = {
        'INFO': 'border-blue-500',
        'LOW': 'border-green-500',
        'MEDIUM': 'border-yellow-500',
        'HIGH': 'border-orange-500',
        'CRITICAL': 'border-red-500',
        'UNKNOWN': 'border-gray-500'
    };
    return classes[severity] || 'border-gray-500';
}

// Get severity text class
function getSeverityTextClass(severity) {
    const classes = {
        'INFO': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        'LOW': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        'MEDIUM': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        'HIGH': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        'CRITICAL': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        'UNKNOWN': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    };
    return classes[severity] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
} 