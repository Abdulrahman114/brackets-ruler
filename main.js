/*
 * The MIT License (MIT)
 * Copyright (c) 2013 Lance Campbell. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, regexp: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, Mustache */

define(function (require, exports, module) {
    "use strict";
    
    // --- Required modules ---
    var PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        Menus               = brackets.getModule("command/Menus"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils");
    
    // --- Constants ---
    var COMMAND_NAME    = "Toggle Ruler",
        COMMAND_ID      = "lkcampbell.toggle-ruler",
        SHORTCUT_KEY    = "Ctrl-Alt-R";
    
    // --- Local variables ---
    var _defPrefs   = { enabled: false },
        _prefs      = PreferencesManager.getPreferenceStorage(module, _defPrefs),
        _viewMenu   = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU),
        _rulerHTML  = require("text!ruler.html"),
        $rulerPanel = null;
    
    // --- Private Functions ---
    function _createRuler() {
        console.log("Called _createRuler()...");
        $rulerPanel = $(_rulerHTML);
        $("#editor-holder").before($rulerPanel);
    }
    
    function _updateRuler() {
        console.log("Called _updateRuler()...");
        
        if (!$rulerPanel) {
            _createRuler();
        }
    }
    
    function _showRuler() {
        console.log("Called _showRuler()...");
        if ($rulerPanel.is(":hidden")) {
            $rulerPanel.show();
        }
    }
    
    function _hideRuler() {
        console.log("Called _hideRuler()...");
        if ($rulerPanel.is(":visible")) {
            $rulerPanel.hide();
        }
    }
    
    // --- Event handlers ---
    function _toggleRuler() {
        var command         = CommandManager.get(COMMAND_ID),
            rulerEnabled    = !command.getChecked();
        
        console.log("Called _toggleRuler()...");
        
        command.setChecked(rulerEnabled);
        _prefs.setValue("enabled", rulerEnabled);
        
        if (rulerEnabled) {
            _updateRuler();
            _showRuler();
        } else {
            _hideRuler();
        }
    }
    
    // --- Initialize Extension ---
    AppInit.appReady(function () {
        var rulerEnabled = _prefs.getValue("enabled");
        
        // Load ruler style sheet
        ExtensionUtils.loadStyleSheet(module, "ruler.css");
        
        // Register command
        CommandManager.register(COMMAND_NAME, COMMAND_ID, _toggleRuler);
        
        // Add to View menu
        if (_viewMenu) {
            _viewMenu.addMenuItem(COMMAND_ID, SHORTCUT_KEY);
        }
        
        // Apply preferences
        CommandManager.get(COMMAND_ID).setChecked(rulerEnabled);
        
        // If the ruler is enabled, load HTML and display
        if (rulerEnabled) {
            _updateRuler();
            _showRuler();
        }
    });
});
