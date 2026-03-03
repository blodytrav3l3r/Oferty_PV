const fs = require('fs');
let html = fs.readFileSync('public/studnie.html', 'utf8');

// Header toggles - remove default toggleCard, add custom IDs
html = html.replace(/onclick=["']toggleCard\('st-client-offer-content',\s*'st-client-offer-icon'\)["']/g, 'id="btn-client-offer-head" onclick="studnieWizardGoTo(0)"');
html = html.replace(/onclick=["']toggleCard\('general-params-content',\s*'general-params-icon'\)["']/g, 'id="btn-general-params-head" onclick="studnieWizardGoTo(1)"');

// Wizard step 1
const block1Regex = /placeholder="np\. Cena obejmuje transport do 100 km\.\.\."><\/textarea><\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="well-app-layout">/m;
const rep1 = 'placeholder="np. Cena obejmuje transport do 100 km..."></textarea></div>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n                <div id="st-client-offer-next-box" style="margin-top: 1rem; display: flex; justify-content: flex-end; padding: 0.5rem 0.6rem;">\r\n                     <button class="btn btn-primary" onclick="studnieWizardNext(1)">Zatwierdź i przejdź do: <b>Ogólne parametry studni</b> ➡</button>\r\n                </div>\r\n            </div>\r\n\r\n            <div class="well-app-layout" id="wizard-step-body" style="display:none;">';
html = html.replace(block1Regex, rep1);

// Wizard step 2
const block2Regex = /wysokości\)<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<!-- Toolbar/m;
const rep2 = 'wysokości)</button>\r\n                                    </div>\r\n                                </div>\r\n\r\n                            </div>\r\n                        </div>\r\n                        <div id="general-params-next-box" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; padding: 0.5rem 0.6rem;">\r\n                             <button class="btn btn-primary" onclick="studnieWizardNext(2)">Zatwierdź i przejdź do: <b>Konfigurator elementów</b> ➡</button>\r\n                        </div>\r\n                    </div>\r\n                    <div id="wizard-details-area" style="display:none;">\r\n                    <!-- Toolbar';
html = html.replace(block2Regex, rep2);

// Close details area
const block3Regex = /<\/div>\s*<\/tbody>\s*<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/m;
const rep3 = '</div>\r\n                                </tbody>\r\n                            </table>\r\n                        </div>\r\n                    </div>\r\n                 </div><!-- END WIZARD DETAILS AREA -->\r\n                </div>\r\n            </div>\r\n        </div>';
html = html.replace(block3Regex, rep3);

// Display toggle start - Klient okno
html = html.replace('id="st-client-offer-content" class="card-content" style="display:none;"', 'id="st-client-offer-content" class="card-content" style="display:block;"');

fs.writeFileSync('public/studnie.html', html);
console.log('Done replacement');