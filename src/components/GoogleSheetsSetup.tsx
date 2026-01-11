import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { setScriptUrl, getScriptUrl } from '@/services/googleSheetsApi';
import { FileSpreadsheet, ExternalLink, Check, Copy } from 'lucide-react';

interface GoogleSheetsSetupProps {
  onComplete: () => void;
}

export const GoogleSheetsSetup: React.FC<GoogleSheetsSetupProps> = ({ onComplete }) => {
  const [url, setUrl] = useState(getScriptUrl());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.includes('script.google.com')) {
      toast({
        title: "שגיאה",
        description: "אנא הכניסי URL תקין של Google Apps Script",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      setScriptUrl(url);
      toast({
        title: "הגדרה הושלמה",
        description: "Google Sheets מחובר בהצלחה!",
      });
      onComplete();
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message || "אירעה שגיאה בחיבור",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "הועתק!",
      description: "הטקסט הועתק ללוח",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-700">
            הגדרת Google Sheets
          </CardTitle>
          <p className="text-muted-foreground">
            עקבי אחר ההוראות לחיבור Google Sheets כמסד נתונים
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">1</span>
              צרי Google Sheet חדש
            </h3>
            <p className="text-sm text-muted-foreground mr-8">
              לכי ל-Google Sheets וצרי גיליון חדש עם 3 sheets:
            </p>
            <div className="mr-8 space-y-1 text-sm">
              <div className="flex items-center justify-between p-2 bg-background rounded">
                <code>users</code>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard('id\temail\tpassword\tcreatedAt')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-2 bg-background rounded">
                <code>tenants</code>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard('id\tuserId\tname\tmonthlyRent\tmonthlyElectricity\tmonthlyWater\tmonthlyCommittee\tmonthlyGas\twaterMeter\telecricityMeter\tgasMeter\tcreatedAt')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-2 bg-background rounded">
                <code>payments</code>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard('id\ttenantId\tuserId\thebrewMonth\thebrewYear\trentPaid\telecricityPaid\twaterPaid\tcommitteePaid\tgasPaid\tcreatedAt\tupdatedAt')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">2</span>
              הוסיפי את הקוד ל-Apps Script
            </h3>
            <p className="text-sm text-muted-foreground mr-8">
              בגיליון: Extensions → Apps Script → הדביקי את הקוד מהקובץ <code>GOOGLE_APPS_SCRIPT_CODE.js</code>
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">3</span>
              פרסמי את ה-Web App
            </h3>
            <p className="text-sm text-muted-foreground mr-8">
              לחצי Deploy → New Deployment → בחרי "Web app" → Execute as: Me, Access: Anyone → Deploy
            </p>
          </div>

          {/* Step 4 - URL Input */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center">4</span>
              הדביקי את ה-URL
            </h3>
            <form onSubmit={handleSubmit} className="mr-8 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="scriptUrl">Web App URL</Label>
                <Input
                  id="scriptUrl"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? 'מתחבר...' : 'חבר את Google Sheets'}
                <Check className="w-4 h-4 mr-2" />
              </Button>
            </form>
          </div>

          <div className="text-center">
            <a 
              href="https://sheets.google.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 hover:underline inline-flex items-center gap-1 text-sm"
            >
              פתחי Google Sheets
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
