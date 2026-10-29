-- Payment "reference" becomes the host's notes on a pair (paid or unpaid).
ALTER TABLE "pairs" RENAME COLUMN "reference" TO "notes";
