// ==UserScript==
// @name         WaniKani External Definition
// @namespace    http://www.wanikani.com
// @version      0.10
// @description  Get External Definition from Weblio, Kanjipedia
// @author       NicoleRauch (original script by polv)
// @match        *://www.wanikani.com/review/session*
// @match        *://www.wanikani.com/lesson/session*
// @match      *://www.wanikani.com/*vocabulary/*
// @match      *://www.wanikani.com/*kanji/*
// @match      *://www.wanikani.com/*radical/*
// @grant        GM_xmlhttpRequest
// @connect      kanjipedia.jp
// @connect      weblio.jp
// ==/UserScript==

(function () {
    'use strict';

    var link_color = "color: #666666;";

    // redefine the crosslink CSS class from weblio:
    var style = document.createElement('style');
    style.innerHTML = '.crosslink { ' + link_color + ' text-decoration: none;}';
    document.getElementsByTagName('head')[0].appendChild(style);
    ///////////////////////////////////////////////////////////////////////////////////////////////////


    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Updating the kanji and vocab we are looking for
    var kanji;
    var vocab;

    var url = document.URL;

    $.jStorage.listenKeyChange('currentItem', function () {
        var current = $.jStorage.get('currentItem');
        kanji = current.kan;
        vocab = current.voc ? current.voc.replace(/する|〜/, '') : undefined;
    });

    $.jStorage.listenKeyChange('l/currentLesson', function () {
        var current = $.jStorage.get('l/currentLesson');
        kanji = current.kan;
        vocab = current.voc ? current.voc.replace(/する|〜/, '') : undefined;
    });

    var urlParts = url.split("/");
    if (urlParts[urlParts.length - 2] === "kanji") {
        kanji = urlParts[urlParts.length - 1];
        updateInfo();
    }
    if (urlParts[urlParts.length - 2] === "vocabulary") {
        vocab = urlParts[urlParts.length - 1].replace(/する|〜/, '');
        updateInfo();
    }


    ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Loading the information and updating the webpage
    function updateInfo() {
        var hrefColor = ' style="' + link_color + '"';

        function insertDefinition(clazz, html, full_url, name, lessonInsertAfter) {
            if (url.indexOf('kanji') !== -1 || url.indexOf('vocabulary') !== -1 || url.indexOf('review') !== -1) {
                $('<section class="' + clazz + '"></section>').insertBefore('#note-meaning');
            }
            if (url.indexOf('lesson') !== -1) {
                $('<section class="' + clazz + '"></section>').insertAfter(lessonInsertAfter);
            }

            $('.' + clazz).html(html + '<a href="' + full_url + '"' + hrefColor + ' target="_blank">Click for full entry</a>');
            var h2_style = url.indexOf('lesson') !== -1 ? ' style="margin-top: 1.25em;" ' : "";
            $('.' + clazz).prepend('<h2' + h2_style + '>' + name + ' Explanation</h2>');
            $('.' + clazz).css('display', 'block');
        }

        // First, remove any already existing entries:
        $('.weblio').remove();
        $('.kanjipedia').remove();

        if (kanji) {
            var url_base = 'https://www.kanjipedia.jp/';
            var regexImgSrc = /img src="/g;
            var replacementImgSrc = 'img width="16px" src="' + url_base;
            var regexSpaceBeforeCircledNumber = / ([\u2460-\u2473])/g;
            GM_xmlhttpRequest({
                method: "GET",
                url: url_base + 'search?k=' + kanji + '&kt=1&sk=leftHand',
                onload: function (data) {
                    var rawKanjiURL = $('<div />').append(data.responseText.replace(regexImgSrc, replacementImgSrc)).find('#resultKanjiList a')[0].href;
                    var kanjiPageURL = url_base + rawKanjiURL.slice(25);
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: kanjiPageURL,
                        onload: function (data) {
                            var rawResponseNode = $('<div />').append(data.responseText.replace(regexImgSrc, replacementImgSrc));

                            }

                            var kanjiDefinition = (rawResponseNode.find('#kanjiRightSection p').html() || "Definition not found.")
                                .replace(regexSpaceBeforeCircledNumber, "<br/>$1");
                            insertDefinition('kanjipedia', "<div style='margin-bottom: 0;'>" + kanjiDefinition + "</div>",
                                kanjiPageURL, 'Kanjipedia', '#supplement-kan-meaning-mne');
                        }
                    });
                }
            });
        }
        if (vocab) {
            var vocabPageURL = 'https://www.weblio.jp/content/' + vocab;
            GM_xmlhttpRequest({
                method: "GET",
                url: vocabPageURL,
                onload: function (data) {
                    var vocabDefinition = $('<div />').append(data.responseText).find('.kiji > div').filter(
                        function() {
                            return $('script', this).length === 0
                        }).html() || "Definition not found.";

                    insertDefinition('weblio', "<div style='margin-bottom: 10px'>" + vocabDefinition + "</div>",
                        vocabPageURL, 'Weblio', '#supplement-voc-meaning-exp');
                }
            });
        }
    }


    // trigggering on review change, but only when on meaning page:
    if($('#item-info-col2').get(0)) {  // mutation observer throws an error if the node is undefined
        new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; ++i) {
                for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
                    var addedNode = mutations[i].addedNodes[j];
                    if (addedNode.id === "note-meaning" &&
                        (addedNode.attributes.style === undefined || addedNode.attributes.style.nodeValue.indexOf("none") === -1)) {
                        updateInfo();
                    }
                }
            }
        }).observe($('#item-info-col2').get(0), {childList: true, attributes: true});
    }

    // trigggering on lesson vocab change, but only when on meaning page:
    if($('#supplement-voc-meaning').get(0)) { // mutation observer throws an error if the node is undefined
        new MutationObserver(function (mutations) {
            var i = 0;
            if (mutations[i].target && mutations[i].target.id === "supplement-voc-meaning"
                && mutations[i].target.style && JSON.stringify(mutations[i].target.style).indexOf("display: none") === -1) {
                updateInfo();
            }
        }).observe($('#supplement-voc-meaning').get(0), {attributes: true});
    }

    // trigggering on lesson kanji change, but only when on meaning page:
    if($('#supplement-kan-meaning').get(0)) { // mutation observer throws an error if the node is undefined
        new MutationObserver(function (mutations) {
            var i = 0;
            if (mutations[i].target && mutations[i].target.id === "supplement-kan-meaning"
                && mutations[i].target.style && JSON.stringify(mutations[i].target.style).indexOf("display: none") === -1) {
                updateInfo();
            }
        }).observe($('#supplement-kan-meaning').get(0), {attributes: true});
    }

    /*
    var observer3 = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; ++i) {
            for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
                if (mutations[i].addedNodes[j].style.display === "block") {
                    $('.weblio').css('display', 'block');
                    $('.kanjipedia').css('display', 'block');
                }
            }
        }
    });
    observer3.observe($('#item-info-meaning-mnemonic').get(0), {attributes: true});
    */

})();
