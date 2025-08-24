// Quick script to clear stuck blocking rules
chrome.declarativeNetRequest.getDynamicRules().then(rules => {
  const ourRuleIds = rules.filter(rule => rule.id >= 1000 && rule.id < 10000).map(rule => rule.id);
  if (ourRuleIds.length > 0) {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ourRuleIds
    }).then(() => {
      console.log('✅ Cleared', ourRuleIds.length, 'stuck blocking rules');
    });
  } else {
    console.log('ℹ️ No stuck rules to clear');
  }
});
