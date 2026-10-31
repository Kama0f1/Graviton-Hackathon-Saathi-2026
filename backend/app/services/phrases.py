"""Fixed sentences the backend speaks itself, in English, Hindi and Punjabi.
Anything that must be exactly right comes from here, not from the AI."""
from .prompts import lang_code

P = {
    "en": {
        "hz_stairs_up": "Stairs going up", "hz_stairs_down": "Stairs going down", "hz_step_down": "A step down",
        "hz_kerb": "Kerb", "hz_wall": "Wall", "hz_glass": "Glass door or glass wall", "hz_door": "Closed door",
        "hz_pole": "Pole", "hz_pothole": "Pothole", "hz_open_drain": "Open drain", "hz_vehicle": "Vehicle",
        "hz_two_wheeler": "Bike or scooter", "hz_animal": "Animal", "hz_person": "Person in the way", "hz_wet_floor": "Wet floor",
        "hz_barrier": "Barrier", "hz_low_obstacle": "Something low on the floor", "hz_other": "Something in the way",
        "pos_left": "on your left", "pos_ahead": "ahead", "pos_right": "on your right",
        "hz_at": "{thing} {pos}, {d}.", "hz_now": "Stop. {thing} {pos}, right in front of you.",
        "m_one": "1 metre", "m_many": "{n} metres", "m_less": "less than 1 metre",
        "bf_bin": "Bin", "bf_col": "{c} bin", "bf_at": "{thing} {pos}, {d}.", "bf_here": "{thing} right in front of you. Reach out.",
        "bf_none": "No bin in view. Turn slowly.",
        "col_blue": "Blue", "col_green": "Green", "col_red": "Red", "col_yellow": "Yellow", "col_grey": "Grey", "col_black": "Black", "col_steel": "Steel",
        "bin_green": "Green bin", "bin_blue": "Blue bin", "bin_red": "Red bin",
        "bin_none": "I'm not sure which bin.",
        "cat_wet": "Wet waste", "cat_dry": "Dry waste", "cat_hazardous": "Hazardous waste",
        "rupees": "rupees",
        "bill_head": "{shop}. {n} items. Total {total}.",
        "bill_head_noshop": "Bill with {n} items. Total {total}.",
        "bill_head_nototal": "{shop}. {n} items. No total is printed. The items add up to {sum}.",
        "mismatch": "Warning: the items add up to {sum}, but the total says {total}.",
        "multiple_bills": "There is more than one bill in the photo. Reading the clearest one.",
        "item_code": "Item {code}",
        "retake": "Some numbers are unclear. Please take the photo again.",
        "no_doc": "Please read a document first.",
        "money_total": "Total {total}.",
        "money_paying": "You are paying {paid}. The bill is {bill}. You should get {expected} back.",
        "money_exact": "That is exactly the bill amount. No change is due.",
        "money_not_enough": "That is {short} less than the bill of {bill}.",
        "change_ok": "Correct change: you got {got}.",
        "change_short": "You should get {expected}, but you got {got}. {diff} short.",
        "change_extra": "You should get {expected}, but you got {got}. {diff} extra.",
        "need_bill": "Read the bill first, then check the change.",
        "need_paid": "Count the money you are paying first.",
        "money_unclear": "Some notes are unclear or overlapping. Spread them out and take the photo again.",
        "money_none": "I can't see any money in the photo.",
        "note": "note", "notes": "notes", "coin": "coin", "coins": "coins",
        "fake_one": "Warning: the {value} rupee note may be fake: {reason}. Do not accept it.",
        "no_obvious_fake": "No obvious signs of a fake on {n} {notes}. I can only catch obvious fakes, so check large amounts with a bank.",
        "money_which": "I am not sure if this is a {a} or a {b} rupee note. Hold it flat with the number facing the camera.",
        "note_is": "This is a {value} rupee note.", "notes_are": "{n} notes: {values} rupees.",
        "check_all": "No signs of a fake: the Reserve Bank text, Gandhi's portrait and the security thread all look right.",
        "check_some": "No obvious signs of a fake.", "check_bank": "For big amounts, also check at a bank.",
        "check_turn": "Turn it over so I can see Gandhi's portrait and the security thread.",
        "reason_not_rbi": "it does not say Reserve Bank of India",
        "reason_toy_text": "it has toy or film-prop text on it",
        "reason_photocopy": "it looks like a photocopy or printout",
        "reason_mismatch": "its colour or design does not match a real note of that value",
        "reason_other": "something looks wrong on it",
        "move_left": "Move phone left.", "move_right": "Move phone right.",
        "move_up": "Move phone up.", "move_down": "Move phone down.",
        "move_closer": "Move closer.", "move_back": "Move back a little.",
        "move_hold": "Hold still.", "move_light": "Too dark. Find more light.", "move_none": "",
    },
    "hi": {
        "hz_stairs_up": "ऊपर जाती सीढ़ियाँ", "hz_stairs_down": "नीचे जाती सीढ़ियाँ", "hz_step_down": "नीचे एक कदम",
        "hz_kerb": "फुटपाथ का किनारा", "hz_wall": "दीवार", "hz_glass": "शीशे का दरवाज़ा या दीवार", "hz_door": "बंद दरवाज़ा",
        "hz_pole": "खंभा", "hz_pothole": "गड्ढा", "hz_open_drain": "खुला नाला", "hz_vehicle": "गाड़ी",
        "hz_two_wheeler": "बाइक या स्कूटर", "hz_animal": "जानवर", "hz_person": "रास्ते में कोई व्यक्ति", "hz_wet_floor": "गीला फ़र्श",
        "hz_barrier": "रुकावट", "hz_low_obstacle": "फ़र्श पर कुछ नीचा रखा है", "hz_other": "रास्ते में कुछ है",
        "pos_left": "आपकी बाईं ओर", "pos_ahead": "सामने", "pos_right": "आपकी दाईं ओर",
        "hz_at": "{thing} {pos}, {d}।", "hz_now": "रुकिए। {thing} {pos}, बिल्कुल पास।",
        "m_one": "1 मीटर पर", "m_many": "{n} मीटर पर", "m_less": "1 मीटर से कम दूरी पर",
        "bf_bin": "डिब्बा", "bf_col": "{c} डिब्बा", "bf_at": "{thing} {pos}, {d}।", "bf_here": "{thing} ठीक आपके सामने है। हाथ बढ़ाइए।",
        "bf_none": "कोई डिब्बा नहीं दिख रहा। धीरे-धीरे घूमें।",
        "col_blue": "नीला", "col_green": "हरा", "col_red": "लाल", "col_yellow": "पीला", "col_grey": "स्लेटी", "col_black": "काला", "col_steel": "स्टील का",
        "bin_green": "हरा डिब्बा", "bin_blue": "नीला डिब्बा", "bin_red": "लाल डिब्बा",
        "bin_none": "पक्का नहीं पता कौन सा डिब्बा।",
        "cat_wet": "गीला कचरा", "cat_dry": "सूखा कचरा", "cat_hazardous": "खतरनाक कचरा",
        "rupees": "रुपये",
        "bill_head": "{shop}। {n} सामान। कुल {total}।",
        "bill_head_noshop": "बिल में {n} सामान। कुल {total}।",
        "bill_head_nototal": "{shop}। {n} सामान। कुल राशि लिखी नहीं है। सामान का जोड़ {sum} है।",
        "mismatch": "ध्यान दें: सामान का जोड़ {sum} है, लेकिन बिल पर कुल {total} लिखा है।",
        "multiple_bills": "फ़ोटो में एक से ज़्यादा बिल हैं। सबसे साफ़ वाला पढ़ रहा हूँ।",
        "item_code": "आइटम {code}",
        "retake": "कुछ अंक साफ़ नहीं हैं। कृपया फ़ोटो दोबारा लें।",
        "no_doc": "पहले कोई दस्तावेज़ पढ़ें।",
        "money_total": "कुल {total}।",
        "money_paying": "आप {paid} दे रहे हैं। बिल {bill} का है। आपको {expected} वापस मिलने चाहिए।",
        "money_exact": "यह बिल के बराबर है। कोई छुट्टा नहीं बनता।",
        "money_not_enough": "यह बिल {bill} से {short} कम है।",
        "change_ok": "छुट्टा सही है: आपको {got} मिले।",
        "change_short": "आपको {expected} मिलने चाहिए, पर {got} मिले। {diff} कम हैं।",
        "change_extra": "आपको {expected} मिलने चाहिए, पर {got} मिले। {diff} ज़्यादा हैं।",
        "need_bill": "पहले बिल पढ़ें, फिर छुट्टा जाँचें।",
        "need_paid": "पहले वो पैसे गिनें जो आप दे रहे हैं।",
        "money_unclear": "कुछ नोट साफ़ नहीं हैं या एक-दूसरे पर हैं। उन्हें फैलाकर फ़ोटो दोबारा लें।",
        "money_none": "फ़ोटो में कोई पैसे नहीं दिख रहे।",
        "note": "नोट", "notes": "नोट", "coin": "सिक्का", "coins": "सिक्के",
        "fake_one": "सावधान: {value} रुपये का नोट नकली हो सकता है: {reason}। इसे न लें।",
        "no_obvious_fake": "{n} {notes} में नकली होने के कोई साफ़ निशान नहीं दिखे। मैं सिर्फ़ साफ़ दिखने वाले नकली नोट पकड़ सकता हूँ, बड़ी रकम बैंक से जाँचवाएँ।",
        "money_which": "पक्का नहीं कि यह {a} का नोट है या {b} का। नोट सीधा रखें, अंक कैमरे की ओर।",
        "note_is": "यह {value} रुपये का नोट है।", "notes_are": "{n} नोट: {values} रुपये।",
        "check_all": "नकली होने का कोई निशान नहीं: रिज़र्व बैंक का नाम, गांधी जी की तस्वीर और सुरक्षा धागा सब ठीक दिख रहे हैं।",
        "check_some": "नकली होने का कोई साफ़ निशान नहीं।", "check_bank": "बड़ी रकम हो तो बैंक में भी जाँच लें।",
        "check_turn": "नोट पलटें ताकि मैं गांधी जी की तस्वीर और सुरक्षा धागा देख सकूँ।",
        "reason_not_rbi": "इस पर रिज़र्व बैंक ऑफ़ इंडिया नहीं लिखा है",
        "reason_toy_text": "इस पर खिलौने या फ़िल्म वाले नोट का लिखा है",
        "reason_photocopy": "यह फ़ोटोकॉपी या प्रिंटआउट जैसा लगता है",
        "reason_mismatch": "इसका रंग या डिज़ाइन असली नोट से मेल नहीं खाता",
        "reason_other": "इसमें कुछ गड़बड़ लगती है",
        "move_left": "फ़ोन बाईं ओर ले जाएँ।", "move_right": "फ़ोन दाईं ओर ले जाएँ।",
        "move_up": "फ़ोन ऊपर करें।", "move_down": "फ़ोन नीचे करें।",
        "move_closer": "पास लाएँ।", "move_back": "थोड़ा पीछे करें।",
        "move_hold": "स्थिर रखें।", "move_light": "रोशनी कम है।", "move_none": "",
    },
    "pa": {
        "hz_stairs_up": "ਉੱਪਰ ਜਾਂਦੀਆਂ ਪੌੜੀਆਂ", "hz_stairs_down": "ਹੇਠਾਂ ਜਾਂਦੀਆਂ ਪੌੜੀਆਂ", "hz_step_down": "ਹੇਠਾਂ ਇੱਕ ਕਦਮ",
        "hz_kerb": "ਫੁੱਟਪਾਥ ਦਾ ਕਿਨਾਰਾ", "hz_wall": "ਕੰਧ", "hz_glass": "ਸ਼ੀਸ਼ੇ ਦਾ ਦਰਵਾਜ਼ਾ ਜਾਂ ਕੰਧ", "hz_door": "ਬੰਦ ਦਰਵਾਜ਼ਾ",
        "hz_pole": "ਖੰਭਾ", "hz_pothole": "ਟੋਆ", "hz_open_drain": "ਖੁੱਲ੍ਹਾ ਨਾਲਾ", "hz_vehicle": "ਗੱਡੀ",
        "hz_two_wheeler": "ਬਾਈਕ ਜਾਂ ਸਕੂਟਰ", "hz_animal": "ਜਾਨਵਰ", "hz_person": "ਰਸਤੇ ਵਿੱਚ ਕੋਈ ਵਿਅਕਤੀ", "hz_wet_floor": "ਗਿੱਲਾ ਫ਼ਰਸ਼",
        "hz_barrier": "ਰੁਕਾਵਟ", "hz_low_obstacle": "ਫ਼ਰਸ਼ 'ਤੇ ਕੁਝ ਨੀਵਾਂ ਪਿਆ ਹੈ", "hz_other": "ਰਸਤੇ ਵਿੱਚ ਕੁਝ ਹੈ",
        "pos_left": "ਤੁਹਾਡੇ ਖੱਬੇ ਪਾਸੇ", "pos_ahead": "ਸਾਹਮਣੇ", "pos_right": "ਤੁਹਾਡੇ ਸੱਜੇ ਪਾਸੇ",
        "hz_at": "{thing} {pos}, {d}।", "hz_now": "ਰੁਕੋ। {thing} {pos}, ਬਿਲਕੁਲ ਨੇੜੇ।",
        "m_one": "1 ਮੀਟਰ 'ਤੇ", "m_many": "{n} ਮੀਟਰ 'ਤੇ", "m_less": "1 ਮੀਟਰ ਤੋਂ ਘੱਟ ਦੂਰੀ 'ਤੇ",
        "bf_bin": "ਡੱਬਾ", "bf_col": "{c} ਡੱਬਾ", "bf_at": "{thing} {pos}, {d}।", "bf_here": "{thing} ਬਿਲਕੁਲ ਤੁਹਾਡੇ ਸਾਹਮਣੇ ਹੈ। ਹੱਥ ਵਧਾਓ।",
        "bf_none": "ਕੋਈ ਡੱਬਾ ਨਹੀਂ ਦਿਸ ਰਿਹਾ। ਹੌਲੀ-ਹੌਲੀ ਘੁੰਮੋ।",
        "col_blue": "ਨੀਲਾ", "col_green": "ਹਰਾ", "col_red": "ਲਾਲ", "col_yellow": "ਪੀਲਾ", "col_grey": "ਸਲੇਟੀ", "col_black": "ਕਾਲਾ", "col_steel": "ਸਟੀਲ ਦਾ",
        "bin_green": "ਹਰਾ ਡੱਬਾ", "bin_blue": "ਨੀਲਾ ਡੱਬਾ", "bin_red": "ਲਾਲ ਡੱਬਾ",
        "bin_none": "ਪੱਕਾ ਨਹੀਂ ਪਤਾ ਕਿਹੜਾ ਡੱਬਾ।",
        "cat_wet": "ਗਿੱਲਾ ਕੂੜਾ", "cat_dry": "ਸੁੱਕਾ ਕੂੜਾ", "cat_hazardous": "ਖ਼ਤਰਨਾਕ ਕੂੜਾ",
        "rupees": "ਰੁਪਏ",
        "bill_head": "{shop}। {n} ਚੀਜ਼ਾਂ। ਕੁੱਲ {total}।",
        "bill_head_noshop": "ਬਿੱਲ ਵਿੱਚ {n} ਚੀਜ਼ਾਂ। ਕੁੱਲ {total}।",
        "bill_head_nototal": "{shop}। {n} ਚੀਜ਼ਾਂ। ਕੁੱਲ ਰਕਮ ਲਿਖੀ ਨਹੀਂ ਹੈ। ਸਮਾਨ ਦਾ ਜੋੜ {sum} ਹੈ।",
        "mismatch": "ਧਿਆਨ ਦਿਓ: ਸਮਾਨ ਦਾ ਜੋੜ {sum} ਹੈ, ਪਰ ਬਿੱਲ ਤੇ ਕੁੱਲ {total} ਲਿਖਿਆ ਹੈ।",
        "multiple_bills": "ਫ਼ੋਟੋ ਵਿੱਚ ਇੱਕ ਤੋਂ ਵੱਧ ਬਿੱਲ ਹਨ। ਸਭ ਤੋਂ ਸਾਫ਼ ਵਾਲਾ ਪੜ੍ਹ ਰਿਹਾ ਹਾਂ।",
        "item_code": "ਆਈਟਮ {code}",
        "retake": "ਕੁਝ ਅੰਕ ਸਾਫ਼ ਨਹੀਂ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਫ਼ੋਟੋ ਦੁਬਾਰਾ ਲਓ।",
        "no_doc": "ਪਹਿਲਾਂ ਕੋਈ ਦਸਤਾਵੇਜ਼ ਪੜ੍ਹੋ।",
        "money_total": "ਕੁੱਲ {total}।",
        "money_paying": "ਤੁਸੀਂ {paid} ਦੇ ਰਹੇ ਹੋ। ਬਿੱਲ {bill} ਦਾ ਹੈ। ਤੁਹਾਨੂੰ {expected} ਵਾਪਸ ਮਿਲਣੇ ਚਾਹੀਦੇ ਹਨ।",
        "money_exact": "ਇਹ ਬਿੱਲ ਦੇ ਬਰਾਬਰ ਹੈ। ਕੋਈ ਭਾਨ ਨਹੀਂ ਬਣਦੀ।",
        "money_not_enough": "ਇਹ ਬਿੱਲ {bill} ਤੋਂ {short} ਘੱਟ ਹੈ।",
        "change_ok": "ਭਾਨ ਸਹੀ ਹੈ: ਤੁਹਾਨੂੰ {got} ਮਿਲੇ।",
        "change_short": "ਤੁਹਾਨੂੰ {expected} ਮਿਲਣੇ ਚਾਹੀਦੇ ਸਨ, ਪਰ {got} ਮਿਲੇ। {diff} ਘੱਟ ਹਨ।",
        "change_extra": "ਤੁਹਾਨੂੰ {expected} ਮਿਲਣੇ ਚਾਹੀਦੇ ਸਨ, ਪਰ {got} ਮਿਲੇ। {diff} ਵੱਧ ਹਨ।",
        "need_bill": "ਪਹਿਲਾਂ ਬਿੱਲ ਪੜ੍ਹੋ, ਫਿਰ ਭਾਨ ਜਾਂਚੋ।",
        "need_paid": "ਪਹਿਲਾਂ ਉਹ ਪੈਸੇ ਗਿਣੋ ਜੋ ਤੁਸੀਂ ਦੇ ਰਹੇ ਹੋ।",
        "money_unclear": "ਕੁਝ ਨੋਟ ਸਾਫ਼ ਨਹੀਂ ਹਨ ਜਾਂ ਇੱਕ-ਦੂਜੇ ਉੱਤੇ ਹਨ। ਉਹਨਾਂ ਨੂੰ ਖਿਲਾਰ ਕੇ ਫ਼ੋਟੋ ਦੁਬਾਰਾ ਲਓ।",
        "money_none": "ਫ਼ੋਟੋ ਵਿੱਚ ਕੋਈ ਪੈਸੇ ਨਹੀਂ ਦਿਸ ਰਹੇ।",
        "note": "ਨੋਟ", "notes": "ਨੋਟ", "coin": "ਸਿੱਕਾ", "coins": "ਸਿੱਕੇ",
        "fake_one": "ਸਾਵਧਾਨ: {value} ਰੁਪਏ ਦਾ ਨੋਟ ਨਕਲੀ ਹੋ ਸਕਦਾ ਹੈ: {reason}। ਇਸਨੂੰ ਨਾ ਲਓ।",
        "no_obvious_fake": "{n} {notes} ਵਿੱਚ ਨਕਲੀ ਹੋਣ ਦੇ ਕੋਈ ਸਾਫ਼ ਨਿਸ਼ਾਨ ਨਹੀਂ ਦਿਸੇ। ਮੈਂ ਸਿਰਫ਼ ਸਾਫ਼ ਦਿਸਣ ਵਾਲੇ ਨਕਲੀ ਨੋਟ ਫੜ ਸਕਦਾ ਹਾਂ, ਵੱਡੀ ਰਕਮ ਬੈਂਕ ਤੋਂ ਜਾਂਚ ਕਰਵਾਓ।",
        "money_which": "ਪੱਕਾ ਨਹੀਂ ਕਿ ਇਹ {a} ਦਾ ਨੋਟ ਹੈ ਜਾਂ {b} ਦਾ। ਨੋਟ ਸਿੱਧਾ ਰੱਖੋ, ਅੰਕ ਕੈਮਰੇ ਵੱਲ।",
        "note_is": "ਇਹ {value} ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।", "notes_are": "{n} ਨੋਟ: {values} ਰੁਪਏ।",
        "check_all": "ਨਕਲੀ ਹੋਣ ਦਾ ਕੋਈ ਨਿਸ਼ਾਨ ਨਹੀਂ: ਰਿਜ਼ਰਵ ਬੈਂਕ ਦਾ ਨਾਂ, ਗਾਂਧੀ ਜੀ ਦੀ ਤਸਵੀਰ ਅਤੇ ਸੁਰੱਖਿਆ ਧਾਗਾ ਸਭ ਠੀਕ ਦਿਸਦੇ ਹਨ।",
        "check_some": "ਨਕਲੀ ਹੋਣ ਦਾ ਕੋਈ ਸਾਫ਼ ਨਿਸ਼ਾਨ ਨਹੀਂ।", "check_bank": "ਵੱਡੀ ਰਕਮ ਹੋਵੇ ਤਾਂ ਬੈਂਕ ਵਿੱਚ ਵੀ ਜਾਂਚ ਲਓ।",
        "check_turn": "ਨੋਟ ਪਲਟੋ ਤਾਂ ਜੋ ਮੈਂ ਗਾਂਧੀ ਜੀ ਦੀ ਤਸਵੀਰ ਅਤੇ ਸੁਰੱਖਿਆ ਧਾਗਾ ਵੇਖ ਸਕਾਂ।",
        "reason_not_rbi": "ਇਸ ਉੱਤੇ ਰਿਜ਼ਰਵ ਬੈਂਕ ਆਫ਼ ਇੰਡੀਆ ਨਹੀਂ ਲਿਖਿਆ",
        "reason_toy_text": "ਇਸ ਉੱਤੇ ਖਿਡੌਣੇ ਜਾਂ ਫ਼ਿਲਮ ਵਾਲੇ ਨੋਟ ਦਾ ਲਿਖਿਆ ਹੈ",
        "reason_photocopy": "ਇਹ ਫ਼ੋਟੋਕਾਪੀ ਜਾਂ ਪ੍ਰਿੰਟਆਊਟ ਵਰਗਾ ਲੱਗਦਾ ਹੈ",
        "reason_mismatch": "ਇਸਦਾ ਰੰਗ ਜਾਂ ਡਿਜ਼ਾਈਨ ਅਸਲੀ ਨੋਟ ਨਾਲ ਨਹੀਂ ਮਿਲਦਾ",
        "reason_other": "ਇਸ ਵਿੱਚ ਕੁਝ ਗੜਬੜ ਲੱਗਦੀ ਹੈ",
        "move_left": "ਫ਼ੋਨ ਖੱਬੇ ਪਾਸੇ ਕਰੋ।", "move_right": "ਫ਼ੋਨ ਸੱਜੇ ਪਾਸੇ ਕਰੋ।",
        "move_up": "ਫ਼ੋਨ ਉੱਪਰ ਕਰੋ।", "move_down": "ਫ਼ੋਨ ਹੇਠਾਂ ਕਰੋ।",
        "move_closer": "ਨੇੜੇ ਲਿਆਓ।", "move_back": "ਥੋੜ੍ਹਾ ਪਿੱਛੇ ਕਰੋ।",
        "move_hold": "ਸਥਿਰ ਰੱਖੋ।", "move_light": "ਰੋਸ਼ਨੀ ਘੱਟ ਹੈ।", "move_none": "",
    },
}


def t(key: str, lang: str = "en", **values) -> str:
    """t("mismatch", "hi", sum="4,350", total="4,830") -> the Hindi warning."""
    text = P[lang_code(lang)].get(key) or P["en"][key]
    return text.format(**values) if values else text


def money(x: float) -> str:
    """4350.0 -> "4,350"; 12.5 -> "12.50"."""
    return f"{x:,.0f}" if float(x).is_integer() else f"{x:,.2f}"


def qty(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:g}"


# currency code -> (main unit, sub unit) per language
CURRENCY = {
    "INR": {"en": ("rupees", "paise"), "hi": ("रुपये", "पैसे"), "pa": ("ਰੁਪਏ", "ਪੈਸੇ")},
    "EUR": {"en": ("euros", "cents"), "hi": ("यूरो", "सेंट"), "pa": ("ਯੂਰੋ", "ਸੈਂਟ")},
    "USD": {"en": ("dollars", "cents"), "hi": ("डॉलर", "सेंट"), "pa": ("ਡਾਲਰ", "ਸੈਂਟ")},
    "GBP": {"en": ("pounds", "pence"), "hi": ("पाउंड", "पेंस"), "pa": ("ਪੌਂਡ", "ਪੈਂਸ")},
}


def say_money(x: float, currency: str = "INR", lang: str = "en") -> str:
    """23.9 EUR en -> "23 euros 90 cents"; 4350 INR hi -> "4,350 रुपये". Written for speech, not screens."""
    value = round(float(x), 2)
    sign = "minus " if value < 0 else ""
    value = abs(value)
    main = int(value)
    sub = int(round((value - main) * 100))
    if sub == 100:
        main, sub = main + 1, 0
    names = CURRENCY.get((currency or "INR").strip().upper())
    if names is None:  # unknown currency: number + code
        return f"{sign}{money(value)} {(currency or '').upper()}".strip()
    big, small = names[lang_code(lang)]
    return f"{sign}{main:,} {big}" + (f" {sub} {small}" if sub else "")
