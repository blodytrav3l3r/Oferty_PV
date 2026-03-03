import re, codecs

with codecs.open('g:/GitHub/Oferty_PV/public/studnie.html', 'r', 'utf-8') as f:
    text = f.read()

text = text.replace('onclick=\"toggleCard(\'st-client-offer-content\', \'st-client-offer-icon\')\"', 'id=\"btn-client-offer-head\" onclick=\"studnieWizardGoTo(0)\"')
text = text.replace('onclick=\"toggleCard(\'general-params-content\', \'general-params-icon\')\"', 'id=\"btn-general-params-head\" onclick=\"studnieWizardGoTo(1)\"')
text = text.replace('<div class=\"well-app-layout\">', '<div class=\"well-app-layout\" id=\"wizard-step-body\" style=\"display:none;\">')

btn1_target = 'placeholder=\"np. Cena obejmuje transport do 100 km...\"></textarea></div>\n                        </div>\n                    </div>\n                </div>\n            </div>'
btn1_rep = btn1_target.replace('</div>\n            </div>', '<div style=\"margin-top: 1rem; display: flex; justify-content: flex-end;\">\n                        <button class=\"btn btn-primary\" onclick=\"studnieWizardNext(1)\">Krok 2: Parametry ogólne studni ➡</button>\n                    </div>\n                </div>\n            </div>')
text = text.replace(btn1_target, btn1_rep)

btn2_target = 'wysokości)</button>\n                                    </div>\n                                </div>\n\n                            </div>\n                        </div>\n                    </div>'
btn2_rep = 'wysokości)</button>\n                                    </div>\n                                </div>\n\n                            </div>\n                            <!-- NEXT BTN -->\n                            <div style=\"margin-top: 1.5rem; display: flex; justify-content: flex-end;\">\n                                <button class=\"btn btn-primary\" onclick=\"studnieWizardNext(2)\">Krok 3: Konfigurator ➡</button>\n                            </div>\n                        </div>\n                    </div>\n                    <div id=\"wizard-details-area\" style=\"display:none;\">'
text = text.replace(btn2_target, btn2_rep)

text = text.replace('<!-- Toolbar: DN + Elevations + Height + Controls -->', '<div id=\"wizard-details-area\" style=\"display:none;\">\n                    <!-- Toolbar: DN + Elevations + Height + Controls -->')

end_target = '</div>\n                                </tbody>\n                            </table>\n                        </div>\n                    </div>\n                </div>\n            </div>\n        </div>'
end_rep = '</div>\n                                </tbody>\n                            </table>\n                        </div>\n                    </div>\n                    </div> <!-- END WIZARD DETAILS -->\n                </div>\n            </div>\n        </div>'
text = text.replace(end_target, end_rep)

text = text.replace('id=\"st-client-offer-content\" class=\"card-content\" style=\"display:none;\"', 'id=\"st-client-offer-content\" class=\"card-content\" style=\"display:block;\"')


with codecs.open('g:/GitHub/Oferty_PV/public/studnie.html', 'w', 'utf-8') as f:
    f.write(text)

print('Done HTML python update!')
