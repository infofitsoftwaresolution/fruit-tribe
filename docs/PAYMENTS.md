# Payment integration (Razorpay) – analysis and fixes

## Console error: "Refused to get unsafe header x-rtb-fingerprint-id"

### What it is

- The message comes from **Razorpay’s own script** (`checkout.razorpay.com/v1/checkout.js`), not from our app code.
- The script uses `XMLHttpRequest` and tries to read the response header `x-rtb-fingerprint-id`.
- Browsers do not allow JavaScript to read certain response headers (e.g. for security). When the script calls `getResponseHeader('x-rtb-fingerprint-id')`, the browser throws and logs this message.

### Can we fix it in our code?

- **No.** We do not control Razorpay’s script. The fix would have to be:
  - Razorpay changing their script so it does not read that header, or
  - Browsers changing the list of forbidden headers (not something we can do).

### Does it break payment?

- In many cases it is only a **console warning**: the script may still call our `handler` and payment can complete.
- In some environments (browser/version, CORS, HTTPS), the same security behavior can lead to the script failing before it calls our success handler, so the user pays but never sees confirmation.

### What we did on our side

1. **No `crossOrigin` on the script tag**  
   The Razorpay script is loaded without `crossOrigin="anonymous"` to avoid extra CORS behavior that can trigger the forbidden-header path.

2. **Fallback when the modal closes**  
   When the Razorpay modal closes (`ondismiss`), we wait ~2.5s and then:
   - Call our API to get the user’s orders.
   - Find the order by ID and check `paymentStatus`.
   - If `paymentStatus === 'PAID'`, we run the same success flow (clear cart, success toast, redirect to order confirmation).

   So if the user actually paid but our success handler never ran (e.g. because of the script/header issue), they still get the correct confirmation after closing the modal.

3. **HTTPS and same-origin API**  
   The app uses a relative API base (`/api/v1`) in production and `getEffectiveApiBase()` so that from an HTTPS page we never send requests to HTTP (no mixed content). That keeps the Razorpay success handler’s call to our verify-payment API from being blocked.

### When the success handler never runs

If Razorpay’s script fails before calling our `handler`, we never call `verifyPayment`, so the order stays `PENDING` in our DB even though the customer paid. The “on dismiss” fallback only checks our DB, so it cannot mark such orders as PAID.

To handle that case you can:

- **Razorpay webhooks**: Configure a Webhook in the Razorpay Dashboard for `payment.captured`. Your backend receives the event and marks the order PAID (and optionally calls the same logic as `verifyPayment`). Then the “on dismiss” poll will see `PAID` and show confirmation.
- **Or** add a backend endpoint that, when the user returns to “My Orders”, calls Razorpay’s API to fetch payment status for the order and, if captured, updates the order and payments in your DB.

### Recommendations

- Run the store over **HTTPS** in production.
- If the console message is still confusing, treat it as a known Razorpay/browser quirk; our fallback (step 2) should still confirm paid orders when the handler did run.
- For a permanent fix, contact Razorpay support and ask them to stop reading `x-rtb-fingerprint-id` (or handle the SecurityError) in their checkout script.
- Consider adding a Razorpay webhook for `payment.captured` so orders are marked PAID even when the in-browser success handler does not run.
