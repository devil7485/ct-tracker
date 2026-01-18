# CT Signal Tracker - Deployment Checklist

## ✅ Pre-Deployment Checklist

### System Requirements
- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] ~500MB free disk space (for dependencies)
- [ ] ~100MB free disk space (for database growth)
- [ ] Stable internet connection

### Installation Steps
1. [ ] Extract ct-tracker.tar.gz
2. [ ] Navigate to ct-tracker directory
3. [ ] Run `npm install`
4. [ ] Run `npx playwright install chromium`
5. [ ] Run `npm run db:init`

## 📊 First Run Checklist

### Initial Data Collection (15-20 min)
1. [ ] Run `npm run backfill`
   - Expected: ~5-10 minutes
   - Output: 5 handles, ~3000-5000 tweets, ~500-1000 signals
2. [ ] Run `npm run track`
   - Expected: ~5 minutes
   - Output: Performance metrics, verdicts calculated
3. [ ] Run `npm run dev`
   - Expected: Server starts on localhost:3000
   - Output: Dashboard with leaderboard

### Verification Steps
- [ ] Database file created: `./data/ct-tracker.db`
- [ ] Homepage loads at http://localhost:3000
- [ ] Leaderboard shows 5 handles with verdicts
- [ ] Clicking handle shows detail page with calls
- [ ] No console errors in terminal or browser

## 🔄 Daily Operations Checklist

### Morning Routine (5 min)
1. [ ] `npm run update` - Get new tweets
2. [ ] `npm run track` - Update performance
3. [ ] Check dashboard for new data

### Weekly Maintenance
- [ ] Review database size: `du -h data/ct-tracker.db`
- [ ] Check for scraping errors in logs
- [ ] Verify all handles still active

### Monthly Cleanup
- [ ] Archive old database (optional backup)
- [ ] Review and update handle list
- [ ] Check for Playwright updates

## 🐛 Troubleshooting Checklist

### "Database is locked"
- [ ] Kill any running npm processes
- [ ] Wait 10 seconds
- [ ] Try again

### "Failed to scrape @username"
- [ ] Check internet connection
- [ ] Verify handle exists and is public
- [ ] Wait 1-2 hours (rate limit)
- [ ] Try with different handle

### "Playwright errors"
- [ ] Run `npx playwright install chromium`
- [ ] Check disk space
- [ ] Update Playwright: `npm install playwright@latest`

### "No data showing on frontend"
- [ ] Verify database has data: `ls -lh data/ct-tracker.db`
- [ ] Check if backfill completed successfully
- [ ] Restart dev server: `npm run dev`
- [ ] Check browser console for errors (F12)

## 🔐 Security Checklist

- [ ] `.env.local` not committed to git
- [ ] Database not exposed publicly
- [ ] No API keys in source code
- [ ] Frontend only shows historical data
- [ ] No user authentication needed (read-only)

## 📈 Performance Monitoring

### Database Size Expectations
- After backfill: ~5-10 MB
- After 1 month: ~20-50 MB
- After 3 months: ~50-100 MB
- After 6 months: ~100-200 MB

### Scraping Performance
- Backfill (1000 tweets): ~2-3 min per handle
- Update (new tweets): ~30-60 sec per handle
- API rate limit: ~1 request/second

### Server Performance
- Page load: <100ms
- API response: <50ms
- Database queries: <10ms

## 🚀 Production Deployment (Optional)

### If deploying to server:
- [ ] Set `PLAYWRIGHT_HEADLESS=true`
- [ ] Configure cron job for daily updates
- [ ] Set up database backups
- [ ] Use process manager (PM2)
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificate
- [ ] Monitor disk space

### Recommended Cron Jobs
```bash
# Update tweets daily at 6 AM
0 6 * * * cd /path/to/ct-tracker && npm run update

# Track performance daily at 6:30 AM
30 6 * * * cd /path/to/ct-tracker && npm run track
```

## 📝 Data Integrity Checks

### Weekly Verification
- [ ] Check total tweets count is increasing
- [ ] Verify new signals are being extracted
- [ ] Confirm performance tracking is updating
- [ ] Ensure verdicts are recalculating

### SQL Queries for Manual Verification
```sql
-- Total tweets
SELECT COUNT(*) FROM tweets;

-- Total signals
SELECT COUNT(*) FROM signals;

-- Active signals (being tracked)
SELECT COUNT(*) FROM performance_windows WHERE lifecycle_complete = 0;

-- Completed signals
SELECT COUNT(*) FROM performance_windows WHERE lifecycle_complete = 1;

-- Handles with verdicts
SELECT COUNT(*) FROM handle_verdicts;
```

## 🎯 Success Metrics

### After 1 Week
- [ ] 5 handles tracked
- [ ] 3000+ tweets collected
- [ ] 500+ signals extracted
- [ ] 100+ signals tracked
- [ ] 5 verdicts calculated

### After 1 Month
- [ ] 5000+ tweets collected
- [ ] 1000+ signals extracted
- [ ] 300+ signals completed
- [ ] Verdicts updating regularly
- [ ] Clear performance trends

## 🆘 Support Resources

1. **Documentation**
   - README.md (comprehensive guide)
   - QUICKSTART.md (setup instructions)
   - ARCHITECTURE.md (system design)

2. **Code Comments**
   - All functions documented
   - Complex logic explained
   - Examples provided

3. **Logs**
   - Terminal output shows progress
   - Error messages are descriptive
   - Success messages confirm operations

## ✨ Quality Assurance

### Before considering "done"
- [ ] All scripts run without errors
- [ ] Frontend displays data correctly
- [ ] Database structure is correct
- [ ] Performance tracking works
- [ ] Verdicts are calculated
- [ ] Handle pages work
- [ ] No console errors
- [ ] Mobile responsive (optional)

## 🎉 Launch Checklist

- [ ] System fully installed
- [ ] Initial backfill complete
- [ ] Performance tracking working
- [ ] Frontend accessible
- [ ] Data verification passed
- [ ] Documentation reviewed
- [ ] Daily workflow tested
- [ ] Ready to expose CT influencers! 🚀
