/**
 * Rakshak scam knowledge base — the RAG corpus.
 *
 * A curated set of scam archetypes currently active against Indian users.
 * Each entry is retrieved (by embeddings or lexical match) and injected into
 * the verdict prompt so judgments are grounded in known, real-world patterns.
 *
 * This corpus is intentionally easy to extend: add a new object here (or append
 * confirmed cases at runtime) and every future check benefits immediately.
 */

export type ScamStatus = "ongoing" | "trending" | "classic";

export interface ScamPattern {
  id: string;
  name: string;
  category: string;
  status: ScamStatus;
  aliases: string[];
  description: string;
  tactics: string[];
  keywords: string[];
  typical_ask: string;
  advice: string;
}

export const SCAM_CORPUS: ScamPattern[] = [
  {
    id: "digital-arrest",
    name: "Digital Arrest scam",
    category: "impersonation",
    status: "trending",
    aliases: ["fake CBI", "fake police", "customs arrest", "video call arrest"],
    description:
      "Fraudsters posing as CBI, police, customs, or narcotics officers claim your ID or a parcel is linked to a crime and keep you on a video call under 'digital arrest' until you transfer money.",
    tactics: ["impersonating law enforcement", "video call pressure", "threat of arrest", "isolation from family", "urgent money transfer to 'verify'"],
    keywords: ["cbi", "police", "customs", "narcotics", "arrest", "digital arrest", "money laundering", "parcel", "fedex", "aadhaar linked", "case registered", "video call", "do not disconnect"],
    typical_ask: "Transfer money immediately to a 'secure account' to avoid arrest.",
    advice: "No real agency arrests you over a video call or asks for money. Disconnect and call 1930.",
  },
  {
    id: "kyc-update",
    name: "KYC / account-block scam",
    category: "phishing",
    status: "ongoing",
    aliases: ["bank KYC", "PAN update", "account suspended"],
    description:
      "A message claims your bank account, wallet, or SIM will be blocked unless you complete KYC via a link, harvesting login/OTP details.",
    tactics: ["account-block threat", "phishing link", "urgency", "OTP request", "brand impersonation"],
    keywords: ["kyc", "pan", "account blocked", "suspended", "update", "verify", "expire", "link", "click", "reactivate", "sbi", "paytm", "phonepe"],
    typical_ask: "Click a link and enter bank/card/OTP details to 'update KYC'.",
    advice: "Banks never block accounts over SMS links. Open the official app directly, don't click links.",
  },
  {
    id: "upi-refund",
    name: "UPI wrong-transfer / refund scam",
    category: "financial",
    status: "ongoing",
    aliases: ["accidental transfer", "collect request scam", "refund fraud"],
    description:
      "Scammer claims they sent you money by mistake and asks you to return it, or sends a UPI 'collect request' disguised as a refund that actually debits you.",
    tactics: ["fake refund", "collect-request trick", "approve to receive confusion", "screenshot of fake payment"],
    keywords: ["upi", "refund", "wrong transfer", "by mistake", "return money", "collect request", "approve", "gpay", "phonepe", "cashback"],
    typical_ask: "Approve a UPI request or send money back for a 'wrong' transfer.",
    advice: "You never approve/enter a PIN to RECEIVE money. Approving a request sends money out.",
  },
  {
    id: "electricity-bill",
    name: "Electricity disconnection scam",
    category: "phishing",
    status: "trending",
    aliases: ["power cut scam", "bijli bill scam"],
    description:
      "SMS warns your electricity will be cut tonight due to an unpaid bill and asks you to call a number or install an app to 'update' the bill.",
    tactics: ["disconnection threat", "call-back number", "remote-access app install", "night-time urgency"],
    keywords: ["electricity", "power", "disconnect", "bijli", "bill", "tonight", "update", "9:30", "call", "meter"],
    typical_ask: "Call a personal number or install AnyDesk/TeamViewer to pay the bill.",
    advice: "Electricity boards don't send disconnection SMS from personal numbers. Never install remote-access apps.",
  },
  {
    id: "courier-customs",
    name: "Courier / customs parcel scam",
    category: "impersonation",
    status: "trending",
    aliases: ["FedEx scam", "DHL parcel", "customs duty"],
    description:
      "Caller claims a parcel in your name contains illegal items or is stuck at customs and demands a fee or personal details.",
    tactics: ["illegal-parcel threat", "customs fee", "identity theft", "transfer to fake police"],
    keywords: ["fedex", "dhl", "courier", "parcel", "customs", "duty", "seized", "illegal", "passport", "drugs"],
    typical_ask: "Pay a customs/clearance fee or share Aadhaar/PAN to release the parcel.",
    advice: "Couriers don't call about illegal parcels. Hang up and verify with the official courier site.",
  },
  {
    id: "task-job",
    name: "Task / like-and-earn job scam",
    category: "job_loan_scam",
    status: "trending",
    aliases: ["part time job", "telegram task", "youtube like job", "prepaid task"],
    description:
      "Offers easy work-from-home tasks (liking videos, rating hotels) with small initial payouts, then asks for deposits into 'prepaid tasks' that are never returned.",
    tactics: ["small initial payout to build trust", "prepaid task deposits", "telegram/whatsapp groups", "fake earnings dashboard"],
    keywords: ["task", "part time", "work from home", "like", "youtube", "telegram", "earn daily", "commission", "prepaid task", "recharge", "deposit"],
    typical_ask: "Deposit money to unlock higher-paying tasks and bigger commissions.",
    advice: "Real jobs never ask you to deposit money. Any 'pay to earn' task is a scam.",
  },
  {
    id: "loan-app",
    name: "Instant loan-app / harassment scam",
    category: "job_loan_scam",
    status: "ongoing",
    aliases: ["fake loan app", "loan recovery threat"],
    description:
      "Predatory apps offer instant loans, steal contacts/photos, then harass and blackmail borrowers with hidden fees and morphed images.",
    tactics: ["instant approval", "contact/gallery access", "hidden charges", "blackmail", "recovery threats"],
    keywords: ["instant loan", "loan approved", "no documents", "processing fee", "recovery", "emi", "blackmail", "contacts"],
    typical_ask: "Pay a processing fee upfront or grant full phone permissions.",
    advice: "Borrow only from RBI-registered lenders. Never grant contacts/gallery access to loan apps.",
  },
  {
    id: "investment-group",
    name: "Fake investment / stock-tip scam",
    category: "financial",
    status: "trending",
    aliases: ["whatsapp stock group", "crypto doubling", "trading mentor"],
    description:
      "WhatsApp/Telegram groups with a fake 'mentor' show guaranteed returns and a rigged app where balances rise, but withdrawals require ever-more deposits.",
    tactics: ["guaranteed returns", "fake trading app", "celebrity endorsement", "withdrawal blocked without more deposit"],
    keywords: ["investment", "stock", "trading", "crypto", "guaranteed", "returns", "double", "profit", "mentor", "ipo", "group", "withdraw"],
    typical_ask: "Deposit into a trading app promising guaranteed/doubled returns.",
    advice: "Guaranteed returns don't exist. Verify SEBI registration before investing.",
  },
  {
    id: "otp-theft",
    name: "OTP / PIN disclosure scam",
    category: "otp_theft",
    status: "ongoing",
    aliases: ["share OTP", "verification code scam"],
    description:
      "Under any pretext (delivery, prize, bank check), the scammer's real goal is to get you to read out an OTP that authorizes a transaction or account takeover.",
    tactics: ["pretext call", "urgency", "read-out-the-code", "impersonation"],
    keywords: ["otp", "pin", "cvv", "verification code", "share", "6 digit", "password", "read out"],
    typical_ask: "Share the OTP/PIN/code just received on your phone.",
    advice: "No genuine person or company ever needs your OTP. Sharing it authorizes fraud.",
  },
  {
    id: "lottery-kbc",
    name: "Lottery / KBC prize scam",
    category: "lottery_prize",
    status: "classic",
    aliases: ["kbc lottery", "lucky draw", "you have won"],
    description:
      "Claims you won a large lottery/KBC prize you never entered, then asks for a 'processing fee' or bank details to release winnings.",
    tactics: ["unexpected prize", "processing/GST fee", "whatsapp voice notes", "fake official letters"],
    keywords: ["won", "lottery", "kbc", "lucky draw", "prize", "25 lakh", "reward", "winner", "claim", "registration fee"],
    typical_ask: "Pay a fee or share bank details to claim the prize.",
    advice: "You can't win a lottery you never entered. Any upfront fee = scam.",
  },
  {
    id: "sextortion",
    name: "Sextortion / video-call blackmail",
    category: "impersonation",
    status: "ongoing",
    aliases: ["nude video call", "blackmail scam"],
    description:
      "A stranger initiates a video call, records the victim, then threatens to leak morphed/explicit clips unless paid.",
    tactics: ["unknown video call", "recording", "blackmail", "fake police follow-up"],
    keywords: ["video call", "nude", "blackmail", "leak", "viral", "delete video", "pay", "screen recording"],
    typical_ask: "Pay money to stop a video from being shared.",
    advice: "Don't pay — it never stops. Stop contact, keep evidence, report to 1930/cybercrime.gov.in.",
  },
  {
    id: "olx-army",
    name: "OLX / marketplace 'Army officer' scam",
    category: "financial",
    status: "ongoing",
    aliases: ["olx buyer scam", "army man qr code"],
    description:
      "A fake buyer/seller posing as an Army officer insists on UPI QR payment and tricks the victim into scanning a 'receive' QR that actually pays out.",
    tactics: ["army-officer trust", "QR code trick", "advance payment", "scan to receive confusion"],
    keywords: ["olx", "army", "officer", "qr code", "scan", "advance", "shifting", "buyer", "seller", "urgent sale"],
    typical_ask: "Scan a QR code or approve a request to 'receive' payment.",
    advice: "Scanning a QR or approving a request only SENDS money. Never do it to receive.",
  },
  {
    id: "sim-swap",
    name: "SIM / telecom block scam",
    category: "phishing",
    status: "ongoing",
    aliases: ["sim will be blocked", "aadhaar sim verify"],
    description:
      "Claims your SIM/number will be deactivated for KYC reasons and pushes you to share OTP or press a key, enabling SIM swap or account takeover.",
    tactics: ["deactivation threat", "press-1 prompt", "OTP request", "KYC pretext"],
    keywords: ["sim", "number", "blocked", "deactivate", "trai", "aadhaar", "verify", "press 1", "kyc", "recharge"],
    typical_ask: "Share OTP or follow steps to 'reverify' your SIM.",
    advice: "Telecom KYC is never done via random calls. Don't share OTPs or press prompts.",
  },
  {
    id: "credit-reward",
    name: "Credit-card reward-points expiry scam",
    category: "phishing",
    status: "ongoing",
    aliases: ["reward points expiring", "redeem points app"],
    description:
      "Message says your card reward points expire today; a link/app then captures card number, CVV, and OTP.",
    tactics: ["points-expiry urgency", "phishing link", "malicious APK", "card + OTP capture"],
    keywords: ["reward points", "expire", "redeem", "credit card", "cvv", "today", "download", "apk", "cashback"],
    typical_ask: "Install an app or enter card + OTP to redeem points.",
    advice: "Redeem points only inside your bank's official app. Never install APKs from links.",
  },
];
