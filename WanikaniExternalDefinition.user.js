// ==UserScript==
// @name         WaniKani External Definition
// @namespace    http://www.wanikani.com
// @version      0.8
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
    console.log("url", url);

    $.jStorage.listenKeyChange('currentItem', function () {
        console.log("currentItem", current)
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
    console.log(urlParts)
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

        function insertHTML(clazz, html, full_url, name) {
            if (url.indexOf('kanji') !== -1 || url.indexOf('vocabulary') !== -1 || url.indexOf('review') !== -1) {
                console.log("inserted on item or review page")
                $('<section class="' + clazz + '"></section>').insertBefore('#note-meaning');
            }

            $('.' + clazz).html(html + '<a href="' + full_url + '"' + hrefColor + ' target="_blank">Click for full entries</a>');
            var h2_style = url.indexOf('lesson') !== -1 ? ' style="margin-top: 1.25em;" ' : "";
            $('.' + clazz).prepend('<h2' + h2_style + '>' + name + ' Explanation</h2>');
            $('.' + clazz).css('display', 'block');
        }

        // First, remove any already existing entries:
        $('.weblio').remove();
        $('.kanjipedia').remove();

        if (kanji) {
            var url_base = 'https://www.kanjipedia.jp/';
            var regex = /img src="/g;
            var replacement = 'img width="16px" src="' + url_base;
            console.log('Opening ' + url_base + 'search?k=' + kanji + '&kt=1&sk=leftHand');
            GM_xmlhttpRequest({
                method: "GET",
                url: url_base + 'search?k=' + kanji + '&kt=1&sk=leftHand',
                onload: function (data) {
                    var result = $('<div />').append(data.responseText.replace(regex, replacement)).find('#resultKanjiList a')[0].href;
                    console.log('Opening ' + url_base + result.slice(25));
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url_base + result.slice(25),
                        onload: function (data) {
                            var result2 = $('<div />').append(data.responseText.replace(regex, replacement)).find('#kanjiRightSection p').html();
                            if (result2 === undefined) result2 = "Definition not found.";
                            var regexSpaceBeforeCircledNumber = / ([\u2460-\u2473])/g;
                            result2 = result2.replace(regexSpaceBeforeCircledNumber, "<br/>$1");

                            if (url.indexOf('lesson') !== -1) {
                                $('<section class="kanjipedia"></section>').insertAfter('#supplement-kan-meaning-mne');
                            }

                            insertHTML('kanjipedia', "<div style='margin-bottom: 0;'>" + result2 + "</div>", url_base + result.slice(25), 'Kanjipedia');
                        }
                    });
                }
            });
        }
        if (vocab) {
            var url_vocab = 'https://www.weblio.jp/content/' + vocab;
            console.log('Opening ' + url_vocab);
            GM_xmlhttpRequest({
                method: "GET",
                url: url_vocab,
                onload: function (data) {
                    var result = $('<div />').append(data.responseText).find('.NetDicBody').html();
                    if (result === undefined) {
                        result = "Definition not found.";
                    }
                    if (vocab && vocab.length === 1) {
                        var i = -1;
                        $.each($('<div />').append(data.responseText).find('.NetDicHead .midashigo'), function (index, value) {
                            var str = value.textContent;
                            if (str.indexOf('漢字') !== -1) i = index;
                        });
                        console.log(i);

                        var full_result = $('<div />').append(data.responseText).find('.NetDicBody:nth-child(' + (3 * i + 2) + ')').html();
                        if (i !== -1) {
                            result = '';
                            for (var j = 0; result.length < 200 && nthIndex(full_result, vocab, j) < result.length;) {
                                j++;
                                result = full_result.substring(nthIndex(full_result, vocab, j) - 2, full_result.indexOf('【 ', nthIndex(full_result, vocab, j)));
                            }
                            console.log(result.length);
                        } else
                            result = 'Kanji definition not found.';
                    }


                    if (url.indexOf('lesson') !== -1) {
                        $('<section class="weblio"></section>').insertAfter('#supplement-voc-meaning-exp');
                    }

                    insertHTML('weblio', result, url_vocab, 'Weblio');
                }
            });
        }
    }


    // trigggering on review change, but only when on meaning page:
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

    // trigggering on lesson vocab change, but only when on meaning page:
    new MutationObserver(function (mutations) {
        console.log("lesson vocab change observer", mutations)
        var i = 0;
        if (mutations[i].target && mutations[i].target.id === "supplement-voc-meaning"
            && mutations[i].target.style && JSON.stringify(mutations[i].target.style).indexOf("display: none") === -1) {
            console.log("lesson vocab change observer is triggering")
            updateInfo();
        }
    }).observe($('#supplement-voc-meaning').get(0), {attributes: true});

    // trigggering on lesson kanji change, but only when on meaning page:
    new MutationObserver(function (mutations) {
        console.log("lesson kanji change observer", mutations)
        var i = 0;
        if (mutations[i].target && mutations[i].target.id === "supplement-kan-meaning"
            && mutations[i].target.style && JSON.stringify(mutations[i].target.style).indexOf("display: none") === -1) {
            console.log("lesson kanji change observer is triggering")
            updateInfo();
        }
    }).observe($('#supplement-kan-meaning').get(0), {attributes: true});

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

    function nthIndex(str, pat, n) {
        var L = str.length, i = -1;
        while (n-- && i++ < L) {
            i = str.indexOf(pat, i);
            if (i < 0) break;
        }
        return i;
    }
})();
