/**
 * Reload Extension and Test Override Session Flow
 * Run this in the web app console to reload extension and test complete flow
 */

window.reloadExtensionAndTest = async function() {
    console.log('🔄 === RELOAD EXTENSION AND TEST COMPLETE FLOW ===');
    
    try {
        // Step 1: Reload the extension via chrome.runtime
        console.log('🔄 Attempting to reload extension...');
        
        // Try to reload extension (requires developer mode)
        try {
            await new Promise((resolve, reject) => {
                chrome.management.getAll((extensions) => {
                    const myExtension = extensions.find(ext => 
                        ext.name.includes('Focus') || 
                        ext.name.includes('Tracking') ||
                        ext.id === chrome.runtime.id
                    );
                    
                    if (myExtension) {
                        chrome.management.setEnabled(myExtension.id, false, () => {
                            setTimeout(() => {
                                chrome.management.setEnabled(myExtension.id, true, () => {
                                    console.log('✅ Extension reloaded successfully');
                                    resolve();
                                });
                            }, 1000);
                        });
                    } else {
                        console.log('ℹ️ Could not auto-reload extension - please reload manually');
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.log('ℹ️ Auto-reload not available - please reload extension manually in chrome://extensions/');
        }
        
        // Wait for extension to be ready
        console.log('⏳ Waiting for extension to be ready...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 2: Test extension connectivity
        console.log('🔍 Testing extension connectivity...');
        const isConnected = await window.checkExtensionConnectivity();
        
        if (!isConnected) {
            console.error('❌ Extension not responding - please ensure it\'s reloaded and enabled');
            return;
        }
        
        // Step 3: Run complete test flow
        console.log('🧪 Running complete override session test flow...');
        await window.testOverrideSessionFlow();
        
        console.log('🎉 Test completed! Check the logs above for results.');
        
    } catch (error) {
        console.error('❌ Test flow failed:', error);
    }
};

console.log('🔄 Extension reload and test function loaded: reloadExtensionAndTest()');