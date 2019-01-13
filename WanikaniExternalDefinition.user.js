// ==UserScript==
// @name         WaniKani External Definition
// @namespace    http://www.wanikani.com
// @version      0.7
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

(function() {
    'use strict';

    var kanji;
    var vocab;

    var w = $('div#character').text().trim().replace(/する|〜/,'');
    if(w.length === 1) {
        kanji = w;
    } else {
        vocab = w;
    }

    var url = document.URL;
    console.log("url", url);

    $.jStorage.listenKeyChange('currentItem', function () {
        console.log("currentItem", current)
        var current = $.jStorage.get('currentItem');
        kanji = current.kan;
        vocab = current.voc ? current.voc.replace(/する|〜/,'') : undefined;
        updateInfo();
    });

    $.jStorage.listenKeyChange('l/currentLesson', function () {
        var current = $.jStorage.get('l/currentLesson');
        kanji = current.kan;
        vocab = current.voc ? current.voc.replace(/する|〜/,'') : undefined;
    });


    function updateInfo(){
        if(kanji) {
            var url_base = 'https://www.kanjipedia.jp/';
            var regex = /img src="/g;
            var replacement = "img width=\"16px\" src=\"" + url_base;
            console.log('Opening ' + url_base + 'search?k=' + kanji + '&kt=1&sk=leftHand');
            GM_xmlhttpRequest({
                method: "GET",
                url: url_base + 'search?k=' + kanji + '&kt=1&sk=leftHand',
                onload: function(data) {
                    var result = $('<div />').append(data.responseText.replace(regex, replacement)).find('#resultKanjiList a')[0].href;
                    console.log('Opening ' + url_base + result.slice(25));
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url_base + result.slice(25),
                        onload: function(data) {
                            var result2 = $('<div />').append(data.responseText.replace(regex, replacement)).find('#kanjiRightSection p').html();
                            if(result2 === undefined) result2 = "Definition not found.";

                            if (url.indexOf('kanji') !== -1) {
                                $('<section class="kanjipedia"></section>').insertBefore('#note-meaning');
                            }
                            $('#item-info-col2').prepend('<section class="kanjipedia"></section>');
                            if(url.indexOf('lesson') !== -1) {
                                $('#supplement-kan-meaning .col2').prepend('<section class="kanjipedia"></section>');
                                $('#supplement-voc-meaning .col2').prepend('<section class="kanjipedia"></section>');
                                console.log('Prepended');
                            } else {
                                if ($.jStorage.get('questionType') === 'reading') $('.kanjipedia').css('display','none');
                            }

                            $('.kanjipedia').html(result2 + '<br><a href="'+ url_base + result.slice(25) +'" target="_blank">Click for full entries</a>');
                            $('.kanjipedia').prepend('<h2>Kanjipedia Explanation</h2>');
                            $('.kanjipedia').css('display','block');
                        }
                    });
                }
            });
        }
        if(vocab) {
            console.log('Opening ' + 'https://www.weblio.jp/content/' + vocab);
            GM_xmlhttpRequest({
                method: "GET",
                url: 'https://www.weblio.jp/content/' + vocab,
                onload: function(data) {
                    var result =  $('<div />').append(data.responseText).find('.NetDicBody').html();
                    if(result === undefined){
                        result = "Definition not found.";
                    }
                    if(vocab.length === 1) {
                        var i = -1;
                        $.each($('<div />').append(data.responseText).find('.NetDicHead .midashigo'), function(index, value){
                            var str = value.textContent;
                            if( str.indexOf('漢字') !== -1 ) i = index;
                        });
                        console.log(i);

                        var full_result = $('<div />').append(data.responseText).find('.NetDicBody:nth-child('+ (3*i+2) +')').html();
                        if (i !== -1){
                            result = '';
                            for(var j=0; result.length < 200 && nthIndex(full_result, vocab, j) < result.length; ) {
                                j++;
                                result = full_result.substring( nthIndex(full_result, vocab, j)-2, full_result.indexOf('【 ', nthIndex(full_result, vocab, j) ) );
                            }
                            console.log(result.length);
                        } else
                            result = 'Kanji definition not found.';
                    }

                    if (url.indexOf('vocabulary') !== -1) {
                        $('<section class="weblio"></section>').insertBefore('#note-meaning');
                    }
                    $('#item-info-col2').prepend('<section class="weblio"></section>');

                    if(url.indexOf('lesson') !== -1){
                        $('#supplement-kan-meaning .col2').prepend('<section class="weblio"></section>');
                        $('#supplement-voc-meaning .col2').prepend('<section class="weblio"></section>');
                        console.log('Prepended');
                    } else {
                        if ($.jStorage.get('questionType') === 'reading') $('.weblio').css('display','none');
                    }

                    $('.weblio').html(result + '<a href="https://www.weblio.jp/content/' + vocab +'" target="_blank">Click for full entries</a>');
                    $('.weblio').prepend('<h2>Weblio Explanation</h2>');
                    $('.weblio').css('display','block');
                }
            });
        }
    }

    var urlParts = url.split("/");
    console.log(urlParts)
    if(urlParts[urlParts.length - 2] === "kanji"){
        kanji = urlParts[urlParts.length - 1];
        updateInfo();
    }
    if(urlParts[urlParts.length - 2] === "vocabulary"){
        vocab = urlParts[urlParts.length - 1].replace(/する|〜/,'');
        updateInfo();
    }



    var observer = new MutationObserver(function(mutations) {
        for(var i=0; i<mutations.length; ++i) {
            for(var j=0; j<mutations[i].addedNodes.length; ++j) {
                if(mutations[i].addedNodes[j].id === "item-info-meaning-mnemonic") {
                    updateInfo();
                }
            }
        }
    });
    observer.observe($('#item-info-col2').get(0), { childList: true });

    // setup observer to change kanji info box contents for subsequent items
    var observer2 = new MutationObserver(function(mutations) {
        var w = $('div#character').text().trim().replace(/する|〜/,'');
        if(w.length === 1){
            kanji = w;
        } else {
            vocab = w;
        }
        $('.weblio').remove();
        $('.kanjipedia').remove();
        updateInfo();
    });
    observer2.observe($('div#character').get(0), { attributes: true, childList: true, characterData: true });

    var observer3 = new MutationObserver(function(mutations) {
        for(var i=0; i<mutations.length; ++i) {
            for(var j=0; j<mutations[i].addedNodes.length; ++j) {
                if(mutations[i].addedNodes[j].style.display === "block") {
                    $('.weblio').css('display','block');
                    $('.kanjipedia').css('display','block');
                }
            }
        }
    });
    observer3.observe($('#item-info-meaning-mnemonic').get(0), { attributes: true });

    function nthIndex(str, pat, n) {
        var L = str.length, i = -1;
        while (n-- && i++ < L) {
            i = str.indexOf(pat, i);
            if (i < 0) break;
        }
        return i;
    }
})();


try { $('.app-store-menu-item').remove(); $('<li class="app-store-menu-item"><a href="https://community.wanikani.com/t/there-are-so-many-user-scripts-now-that-discovering-them-is-hard/20709">App Store</a></li>').insertBefore($('.navbar .dropdown-menu .nav-header:contains("Account")')); window.appStoreRegistry = window.appStoreRegistry || {}; window.appStoreRegistry[GM_info.script.uuid] = GM_info; localStorage.appStoreRegistry = JSON.stringify(appStoreRegistry); } catch (e) {}
