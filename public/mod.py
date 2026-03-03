import codecs
with codecs.open('public/studnie.html', 'r', 'utf-8') as f:
    text = f.read()

text = text.replace('onclick=\"toggleCard(\'st-client-offer-content\', \'st-client-offer-icon\')\"', 'id=\"btn-client-offer-head\" onclick=\"studnieWizardGoTo(0)\"')
text = text.replace('onclick=\"toggleCard(\'general-params-content\', \'general-params-icon\')\"', 'id=\"btn-general-params-head\" onclick=\"studnieWizardGoTo(1)\"')
text = text.replace('<div class=\"well-app-layout\">', '<div class=\"well-app-layout\" id=\"wizard-step-body\" style=\"display:none;\">')

text = text.replace('placeholder=\"np. Cena obejmuje transport do 100 km...\"></textarea></div>\n                        </div>\n                    </div>\n                </div>\n            </div>', 'placeholder=\"np. Cena obejmuje transport do 100 km...\"></textarea></div>\n                        </div>\n                    </div>\n                </div>\n                <!-- WIZARD STEP 1 BTN -->\n                <div style=\"margin-top: 1rem; display: flex; justify-content: flex-end;\">\n                     <button class=\"btn btn-primary\" onclick=\"studnieWizardNext(1)\">Zatwierdź i przejdź do: <b>Ogólne parametry studni</b> ➡</button>\n                </div>\n            </div>')

text = text.replace('wysokości)</button>\n                                    </div>\n                                </div>\n\n                            </div>\n                        </div>\n                    </div>', 'wysokości)</button>\n                                    </div>\n                                </div>\n\n                            </div>\n                        </div>\n                        <!-- WIZARD STEP 2 BTN -->\n                        <div style=\"margin-top: 1.5rem; display: flex; justify-content: flex-end;\">\n                            <button class=\"btn btn-primary\" onclick=\"studnieWizardNext(2)\">Zatwierdź i przejdź do: <b>Konfigurator elementów</b> ➡</button>\n                        </div>\n                    </div>\n                    <div id=\"wizard-details-area\" style=\"display:none;\">')


text = text.replace('</div>\n                                </tbody>\n                            </table>\n                        </div>\n                    </div>\n                </div>\n            </div>\n        </div>', '</div>\n                                </tbody>\n                            </table>\n                        </div>\n                    </div>\n                </div> <!-- END DETAILS WIZARD AREA -->\n                </div>\n            </div>\n        </div>')

with codecs.open('public/studnie.html', 'w', 'utf-8') as f:
    f.write(text)